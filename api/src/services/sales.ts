import { Dec, ZERO, add, dec, div, mul, round, sub, toNumber } from '../../../frontend/src/app/core/domain/decimal';
import { stockLevel } from '../../../frontend/src/app/core/domain/inventory';
import { UnitCode, convert, unitShort } from '../../../frontend/src/app/core/domain/units';
import {
  type DashboardSummary, EXPENSE_CATEGORIES, type Expense, type ExpenseInput, type Ledger, type LedgerEntry,
  type ProductCategory, type Sale, type SaleInput, type SaleResult, type StockShortage,
} from '../../../frontend/src/app/core/models';
import { addDays, daysBetween, shopDateOf, shopDayStart, shopToday } from '../dates';
import { Db, Sql } from '../db';
import { badRequest, notFound } from '../errors';
import { getIngredient, listIngredients, move } from './ingredients';
import { listProducts, listRecipes } from './recipes';

const EXPIRY_WARNING_DAYS = 7;
const MAX_RANGE_DAYS = 366;

const SALE_SELECT = `
  SELECT s.id, s.sold_on AS "soldOn", s.total, s.note, s.created_at AS "createdAt",
         COALESCE(
           json_agg(json_build_object(
             'productId', i.product_id, 'name', i.name, 'saleUnit', i.sale_unit, 'quantity', i.quantity,
             'unitPrice', i.unit_price, 'unitCost', i.unit_cost) ORDER BY i.position)
             FILTER (WHERE i.sale_id IS NOT NULL),
           '[]'
         ) AS items
  FROM sales s LEFT JOIN sale_items i ON i.sale_id = s.id
  WHERE s.voided_at IS NULL`;

export function checkRange(from: string, to: string) {
  const days = daysBetween(from, to);
  if (days < 0) throw badRequest('วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด');
  if (days > MAX_RANGE_DAYS) throw badRequest('ดูได้ครั้งละไม่เกิน 1 ปี');
}

/* ---------------- Sales ---------------- */

export function listSales(sql: Sql, from: string, to: string): Promise<Sale[]> {
  return sql.query<Sale>(
    `${SALE_SELECT} AND s.sold_on BETWEEN $1 AND $2 GROUP BY s.id ORDER BY s.sold_on DESC, s.created_at DESC`,
    [from, to],
  );
}

async function getSale(sql: Sql, id: string): Promise<Sale> {
  const [row] = await sql.query<Sale>(`${SALE_SELECT} AND s.id = $1 GROUP BY s.id`, [id]);
  if (!row) throw notFound('ไม่พบรายการขายนี้ อาจถูกยกเลิกไปแล้ว');
  return row;
}

/**
 * Records what was sold and takes the ingredients out of stock according to each recipe
 * (recipe amount ÷ yield × quantity sold). The sale always saves — the money is real — so when the
 * app's stock is lower than what was used, it goes down to 0 and the shortage is reported back
 * for the owner to fix with "รับเข้า" or "ปรับยอด".
 */
export async function createSale(db: Db, input: SaleInput): Promise<SaleResult> {
  if (input.soldOn > shopToday()) throw badRequest('บันทึกยอดขายของวันที่ยังไม่ถึงไม่ได้');
  const ids = input.items.map((i) => i.productId);
  if (new Set(ids).size !== ids.length) throw badRequest('มีเมนูซ้ำกัน — รวมเป็นบรรทัดเดียว');

  return db.transaction(async (tx) => {
    const products = new Map((await listProducts(tx)).map((p) => [p.id, p]));
    const recipes = new Map((await listRecipes(tx)).map((r) => [r.id, r]));
    const ingredients = new Map((await listIngredients(tx)).map((i) => [i.id, i]));

    const needs = new Map<string, Dec>();
    const lines = input.items.map((item) => {
      const product = products.get(item.productId);
      if (!product) throw badRequest('มีเมนูที่ถูกลบไปแล้ว กรุณาโหลดหน้าใหม่');
      const recipe = product.recipeId ? recipes.get(product.recipeId) : undefined;
      for (const ri of recipe?.items ?? []) {
        const ing = ingredients.get(ri.ingredientId);
        if (!ing) continue;
        const perUnit = div(convert(dec(ri.quantity), ri.unit, ing.baseUnit), dec(recipe!.yieldQty));
        needs.set(ing.id, add(needs.get(ing.id) ?? ZERO, mul(perUnit, dec(item.quantity))));
      }
      return { product, quantity: item.quantity };
    });

    const total = lines.reduce<Dec>((sum, l) => sum + mul(dec(l.product.sellPrice), dec(l.quantity)), ZERO);
    const saleId = crypto.randomUUID();
    await tx.query(`INSERT INTO sales (id, sold_on, total, note) VALUES ($1, $2, $3, $4)`, [
      saleId, input.soldOn, toNumber(round(total, 2)), input.note,
    ]);
    for (const [position, { product, quantity }] of lines.entries()) {
      await tx.query(
        `INSERT INTO sale_items (sale_id, position, product_id, name, sale_unit, quantity, unit_price, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [saleId, position, product.id, product.name, product.saleUnit, quantity, product.sellPrice, product.costPerPiece],
      );
    }

    const shortages: StockShortage[] = [];
    // Sorted ids → rows are always locked in the same order, so two sales can't deadlock.
    for (const id of [...needs.keys()].sort()) {
      const ing = await getIngredient(tx, id, true);
      const need = needs.get(id)!;
      const onHand = dec(ing.quantityOnHand);
      if (need > onHand) {
        shortages.push({
          ingredientId: id, name: ing.name, needed: toNumber(need), available: ing.quantityOnHand,
          baseUnit: ing.baseUnit, displayUnit: ing.displayUnit,
        });
      }
      const take = need > onHand ? onHand : need;
      if (take > ZERO) await move(tx, ing, 'sale', -toNumber(take), { saleId });
    }

    return { sale: await getSale(tx, saleId), shortages };
  });
}

/** Cancels a sale and gives back exactly the stock it took. */
export function voidSale(db: Db, id: string): Promise<void> {
  return db.transaction(async (tx) => {
    const [sale] = await tx.query(`SELECT id FROM sales WHERE id = $1 AND voided_at IS NULL FOR UPDATE`, [id]);
    if (!sale) throw notFound('ไม่พบรายการขายนี้ อาจถูกยกเลิกไปแล้ว');
    const taken = await tx.query<{ ingredientId: string; quantity: number }>(
      `SELECT ingredient_id AS "ingredientId", SUM(quantity) AS quantity FROM stock_transactions
       WHERE sale_id = $1 GROUP BY ingredient_id ORDER BY ingredient_id`,
      [id],
    );
    for (const t of taken) {
      if (t.quantity >= 0) continue;
      const ing = await getIngredient(tx, t.ingredientId, true, true);
      await move(tx, ing, 'sale_reversal', -t.quantity, { saleId: id });
    }
    await tx.query(`UPDATE sales SET voided_at = now() WHERE id = $1`, [id]);
  });
}

/* ---------------- Expenses ---------------- */

const EXPENSE_COLUMNS = `id, spent_on AS "spentOn", category, amount, note, created_at AS "createdAt"`;

export async function createExpense(db: Db, input: ExpenseInput): Promise<Expense> {
  if (input.spentOn > shopToday()) throw badRequest('บันทึกรายจ่ายของวันที่ยังไม่ถึงไม่ได้');
  const [row] = await db.query<Expense>(
    `INSERT INTO expenses (id, spent_on, category, amount, note) VALUES ($1, $2, $3, $4, $5) RETURNING ${EXPENSE_COLUMNS}`,
    [crypto.randomUUID(), input.spentOn, input.category, input.amount, input.note],
  );
  return row;
}

export async function archiveExpense(db: Db, id: string): Promise<void> {
  const rows = await db.query(`UPDATE expenses SET archived_at = now() WHERE id = $1 AND archived_at IS NULL RETURNING id`, [id]);
  if (!rows.length) throw notFound('ไม่พบรายจ่ายนี้ อาจถูกลบไปแล้ว');
}

export async function restoreExpense(db: Db, id: string): Promise<void> {
  const rows = await db.query(`UPDATE expenses SET archived_at = NULL WHERE id = $1 AND archived_at IS NOT NULL RETURNING id`, [id]);
  if (!rows.length) throw notFound('ไม่พบรายจ่ายที่ลบไป');
}

/* ---------------- Ledger (รายรับ-รายจ่าย) ---------------- */

const CATEGORY_LABEL = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]));

export async function ledger(sql: Sql, from: string, to: string): Promise<Ledger> {
  checkRange(from, to);
  const sales = await listSales(sql, from, to);
  const expenses = await sql.query<Expense>(
    `SELECT ${EXPENSE_COLUMNS} FROM expenses WHERE archived_at IS NULL AND spent_on BETWEEN $1 AND $2`,
    [from, to],
  );
  // Ingredients bought through "รับเข้า" are money out too — counted here so nothing is entered twice.
  const purchases = await sql.query<{
    id: string; createdAt: Date; quantity: number; unitCost: number | null; name: string;
    baseUnit: UnitCode; displayUnit: UnitCode;
  }>(
    `SELECT t.id, t.created_at AS "createdAt", t.quantity, t.unit_cost AS "unitCost", i.name,
            i.base_unit AS "baseUnit", i.display_unit AS "displayUnit"
     FROM stock_transactions t JOIN ingredients i ON i.id = t.ingredient_id
     WHERE t.type = 'stock_in' AND t.created_at >= $1 AND t.created_at < $2`,
    [shopDayStart(from), shopDayStart(addDays(to, 1))],
  );

  let income = ZERO;
  let grossProfit = ZERO;
  let costIncomplete = false;
  const entries: LedgerEntry[] = [];

  for (const s of sales) {
    income += dec(s.total);
    for (const item of s.items) {
      if (item.unitCost === null) costIncomplete = true;
      else grossProfit += mul(sub(dec(item.unitPrice), dec(item.unitCost)), dec(item.quantity));
    }
    entries.push({
      kind: 'sale', id: s.id, date: s.soldOn, createdAt: new Date(s.createdAt).toISOString(), title: 'ขายขนม',
      detail: s.items.map((i) => `${i.name} ×${i.quantity}`).join(', '), amount: s.total,
    });
  }

  let expenseTotal = ZERO;
  for (const e of expenses) {
    expenseTotal += dec(e.amount);
    entries.push({
      kind: 'expense', id: e.id, date: e.spentOn, createdAt: new Date(e.createdAt).toISOString(),
      title: CATEGORY_LABEL[e.category] ?? 'รายจ่าย', detail: e.note, amount: -e.amount,
    });
  }

  let purchaseTotal = ZERO;
  for (const p of purchases) {
    const paid = round(mul(dec(p.quantity), dec(p.unitCost ?? 0)), 2);
    purchaseTotal += paid;
    const shown = toNumber(convert(dec(p.quantity), p.baseUnit, p.displayUnit));
    entries.push({
      kind: 'purchase', id: p.id, date: shopDateOf(p.createdAt), createdAt: new Date(p.createdAt).toISOString(),
      title: `ซื้อ${p.name}`, detail: `รับเข้าสต็อก ${shown} ${unitShort(p.displayUnit)}`, amount: -toNumber(paid),
    });
  }

  entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const money = (v: Dec) => toNumber(round(v, 2));
  return {
    from, to,
    income: money(income),
    purchases: money(purchaseTotal),
    expenses: money(expenseTotal),
    net: money(income - purchaseTotal - expenseTotal),
    grossProfit: money(grossProfit),
    costIncomplete,
    entries,
  };
}

/* ---------------- Dashboard ---------------- */

export async function dashboardSummary(sql: Sql): Promise<DashboardSummary> {
  const today = shopToday();
  const todayLedger = await ledger(sql, today, today);
  const [{ total: yesterdaySales }] = await sql.query<{ total: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total FROM sales WHERE voided_at IS NULL AND sold_on = $1`,
    [addDays(today, -1)],
  );

  const sold = await sql.query<{
    productId: string; name: string; category: ProductCategory; imageUrl: string | null; saleUnit: string;
    sellPrice: number; qtySold: number;
  }>(
    `SELECT i.product_id AS "productId", p.name, p.category, p.image_url AS "imageUrl", p.sale_unit AS "saleUnit",
            p.sell_price AS "sellPrice", SUM(i.quantity) AS "qtySold"
     FROM sale_items i JOIN sales s ON s.id = i.sale_id JOIN products p ON p.id = i.product_id
     WHERE s.voided_at IS NULL AND s.sold_on = $1
     GROUP BY i.product_id, p.name, p.category, p.image_url, p.sale_unit, p.sell_price
     ORDER BY "qtySold" DESC, p.name`,
    [today],
  );

  const ingredients = await listIngredients(sql);
  const low = ingredients.filter((i) => stockLevel(i.quantityOnHand, i.minQuantity) !== 'ok');
  const expiring = ingredients.filter(
    (i) => i.quantityOnHand > 0 && i.nearestExpiry !== null && daysBetween(today, i.nearestExpiry) <= EXPIRY_WARNING_DAYS,
  );

  return {
    todaySales: todayLedger.income,
    todaySalesChangePct:
      yesterdaySales > 0 ? Math.round(((todayLedger.income - yesterdaySales) / yesterdaySales) * 100) : null,
    estimatedGrossProfit: todayLedger.grossProfit,
    costIncomplete: todayLedger.costIncomplete,
    todayUnitsSold: sold.reduce((n, s) => n + s.qtySold, 0),
    todayExpenses: toNumber(add(dec(todayLedger.purchases), dec(todayLedger.expenses))),
    lowStock: { count: low.length, names: low.map((i) => i.name) },
    expiringSoon: { count: expiring.length, names: expiring.map((i) => i.name) },
    bestSellers: sold.slice(0, 4),
  };
}
