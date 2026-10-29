import { dec, mul, sub, toNumber } from '../../../frontend/src/app/core/domain/decimal';
import { costPerBaseUnit, weightedAverageCost } from '../../../frontend/src/app/core/domain/inventory';
import { baseUnitOf, convert, isCompatible, toBase, unitLabel } from '../../../frontend/src/app/core/domain/units';
import type {
  AdjustmentInput, Ingredient, IngredientInput, NewIngredientInput, StockInInput, StockTransaction, StockTxType,
  UsageInput,
} from '../../../frontend/src/app/core/models';
import { Db, Sql, isUniqueViolation } from '../db';
import { badRequest, conflict, notFound } from '../errors';

const COLUMNS = `
  id, name, category, base_unit AS "baseUnit", display_unit AS "displayUnit",
  quantity_on_hand AS "quantityOnHand", min_quantity AS "minQuantity",
  avg_cost_per_base_unit AS "avgCostPerBaseUnit", nearest_expiry AS "nearestExpiry", updated_at AS "updatedAt"`;

const TX_COLUMNS = `
  id, ingredient_id AS "ingredientId", type, quantity, unit_cost AS "unitCost", balance_after AS "balanceAfter",
  reason, note, expiry_date AS "expiryDate", created_at AS "createdAt"`;

const duplicateName = (name: string) => conflict(`มีวัตถุดิบชื่อ "${name}" อยู่แล้ว`);

export async function listIngredients(sql: Sql): Promise<Ingredient[]> {
  const rows = await sql.query<Ingredient>(`SELECT ${COLUMNS} FROM ingredients WHERE archived_at IS NULL`);
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

/**
 * `forUpdate` locks the row until the transaction ends, so two stock changes can't race.
 * `includeArchived` is for giving stock back to an ingredient deleted after the sale that used it.
 */
export async function getIngredient(
  sql: Sql,
  id: string,
  forUpdate = false,
  includeArchived = false,
): Promise<Ingredient> {
  const [row] = await sql.query<Ingredient>(
    `SELECT ${COLUMNS} FROM ingredients WHERE id = $1${includeArchived ? '' : ' AND archived_at IS NULL'}` +
      (forUpdate ? ' FOR UPDATE' : ''),
    [id],
  );
  if (!row) throw notFound('ไม่พบวัตถุดิบนี้ อาจถูกลบไปแล้ว');
  return row;
}

export async function createIngredient(db: Db, input: NewIngredientInput): Promise<Ingredient> {
  try {
    return await db.transaction(async (tx) => {
      const id = crypto.randomUUID();
      await tx.query(
        `INSERT INTO ingredients (id, name, category, base_unit, display_unit, min_quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, input.name, input.category, baseUnitOf(input.displayUnit), input.displayUnit,
          toNumber(toBase(dec(input.minQuantity), input.displayUnit))],
      );
      if (input.opening) await receive(tx, await getIngredient(tx, id, true), input.opening, 'opening');
      return getIngredient(tx, id);
    });
  } catch (e) {
    if (isUniqueViolation(e, 'ingredients_name_active_key')) throw duplicateName(input.name);
    throw e;
  }
}

export async function updateIngredient(db: Db, id: string, input: IngredientInput): Promise<Ingredient> {
  const ing = await getIngredient(db, id);
  if (!isCompatible(input.displayUnit, ing.baseUnit)) {
    throw badRequest('เปลี่ยนเป็นหน่วยคนละประเภทไม่ได้ เพราะจะทำให้ยอดคงเหลือผิด');
  }
  try {
    await db.query(
      `UPDATE ingredients SET name = $2, category = $3, display_unit = $4, min_quantity = $5, updated_at = now()
       WHERE id = $1`,
      [id, input.name, input.category, input.displayUnit, toNumber(toBase(dec(input.minQuantity), input.displayUnit))],
    );
  } catch (e) {
    if (isUniqueViolation(e, 'ingredients_name_active_key')) throw duplicateName(input.name);
    throw e;
  }
  return getIngredient(db, id);
}

export async function listTransactions(sql: Sql, id: string): Promise<StockTransaction[]> {
  await getIngredient(sql, id);
  return sql.query<StockTransaction>(
    `SELECT ${TX_COLUMNS} FROM stock_transactions WHERE ingredient_id = $1 ORDER BY created_at DESC`,
    [id],
  );
}

export function stockIn(db: Db, id: string, input: StockInInput): Promise<Ingredient> {
  return db.transaction(async (tx) => {
    await receive(tx, await getIngredient(tx, id, true), input, 'stock_in');
    return getIngredient(tx, id);
  });
}

export function recordUsage(db: Db, id: string, input: UsageInput): Promise<Ingredient> {
  return db.transaction(async (tx) => {
    const ing = await getIngredient(tx, id, true);
    if (!isCompatible(input.unit, ing.baseUnit)) throw badRequest('หน่วยไม่ตรงกับหน่วยของวัตถุดิบ');
    const qty = toNumber(convert(dec(input.quantity), input.unit, ing.baseUnit));
    if (!(qty > 0)) throw badRequest('จำนวนที่เบิกต้องมากกว่า 0');
    await move(tx, ing, 'usage', -qty, { note: input.note });
    return getIngredient(tx, id);
  });
}

export function recordAdjustment(db: Db, id: string, input: AdjustmentInput): Promise<Ingredient> {
  return db.transaction(async (tx) => {
    const ing = await getIngredient(tx, id, true);
    if (!isCompatible(input.unit, ing.baseUnit)) throw badRequest('หน่วยไม่ตรงกับหน่วยของวัตถุดิบ');
    const counted = convert(dec(input.countedQuantity), input.unit, ing.baseUnit);
    const delta = toNumber(sub(counted, dec(ing.quantityOnHand)));
    if (delta === 0) throw badRequest('ยอดที่นับได้เท่ากับยอดในระบบ ไม่ต้องปรับ');
    await move(tx, ing, 'adjustment', delta, { reason: input.reason, note: input.note });
    return getIngredient(tx, id);
  });
}

/**
 * "Delete" = archive: the row stays so its stock history remains intact and undo can restore it.
 * Refused while a menu still uses the ingredient, because that menu's cost would silently break.
 */
export function archiveIngredient(db: Db, id: string): Promise<void> {
  return db.transaction(async (tx) => {
    await getIngredient(tx, id, true);
    const usedBy = await tx.query<{ name: string }>(
      `SELECT r.name FROM recipe_items i JOIN recipes r ON r.id = i.recipe_id
       WHERE i.ingredient_id = $1 AND r.archived_at IS NULL ORDER BY r.name`,
      [id],
    );
    if (usedBy.length) {
      throw conflict(`ยังใช้อยู่ในเมนู ${usedBy.map((r) => `"${r.name}"`).join(', ')} — เอาออกจากสูตรก่อนแล้วค่อยลบ`);
    }
    await tx.query(`UPDATE ingredients SET archived_at = now() WHERE id = $1`, [id]);
  });
}

export async function restoreIngredient(db: Db, id: string): Promise<Ingredient> {
  try {
    const [row] = await db.query<{ name: string }>(
      `UPDATE ingredients SET archived_at = NULL WHERE id = $1 AND archived_at IS NOT NULL RETURNING name`,
      [id],
    );
    if (!row) throw notFound('ไม่พบวัตถุดิบที่ลบไป');
  } catch (e) {
    if (isUniqueViolation(e, 'ingredients_name_active_key')) {
      throw conflict('กู้คืนไม่ได้ เพราะมีวัตถุดิบชื่อเดียวกันเพิ่มเข้ามาแล้ว');
    }
    throw e;
  }
  return getIngredient(db, id);
}

/** Stock arriving: updates the weighted average cost and nearest expiry, then records the movement. */
async function receive(tx: Sql, ing: Ingredient, input: StockInInput, type: StockTxType) {
  if (!isCompatible(input.packUnit, ing.baseUnit)) throw badRequest('หน่วยที่รับเข้าไม่ตรงกับหน่วยของวัตถุดิบ');
  const baseQty = toNumber(mul(convert(dec(input.packSize), input.packUnit, ing.baseUnit), dec(input.packCount)));
  if (!(baseQty > 0)) throw badRequest('จำนวนที่รับเข้าต้องมากกว่า 0');
  const totalPrice = toNumber(mul(dec(input.pricePerPack), dec(input.packCount)));
  const unitCost = costPerBaseUnit(totalPrice, baseQty);
  const avgCost = weightedAverageCost(ing.quantityOnHand, ing.avgCostPerBaseUnit, baseQty, unitCost);
  const nearestExpiry =
    input.expiryDate && (!ing.nearestExpiry || input.expiryDate < ing.nearestExpiry) ? input.expiryDate : ing.nearestExpiry;
  await tx.query(`UPDATE ingredients SET avg_cost_per_base_unit = $2, nearest_expiry = $3 WHERE id = $1`, [
    ing.id, avgCost, nearestExpiry,
  ]);
  await move(tx, { ...ing, avgCostPerBaseUnit: avgCost }, type, baseQty, {
    unitCost, expiryDate: input.expiryDate, note: input.note,
  });
}

/** The only way stock quantity changes: always writes a transaction row in the same DB transaction. */
export async function move(
  tx: Sql,
  ing: Ingredient,
  type: StockTxType,
  deltaBase: number,
  extra: {
    unitCost?: number | null;
    reason?: string | null;
    note?: string | null;
    expiryDate?: string | null;
    saleId?: string | null;
  },
) {
  const balance = toNumber(dec(ing.quantityOnHand) + dec(deltaBase));
  if (balance < 0) {
    const left = toNumber(convert(dec(ing.quantityOnHand), ing.baseUnit, ing.displayUnit));
    throw conflict(`สต็อกไม่พอ — ${ing.name} คงเหลือ ${left} ${unitLabel(ing.displayUnit)}`);
  }
  await tx.query(`UPDATE ingredients SET quantity_on_hand = $2, updated_at = now() WHERE id = $1`, [ing.id, balance]);
  await tx.query(
    `INSERT INTO stock_transactions
       (id, ingredient_id, type, quantity, unit_cost, balance_after, reason, note, expiry_date, sale_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [crypto.randomUUID(), ing.id, type, deltaBase, extra.unitCost ?? ing.avgCostPerBaseUnit, balance,
      extra.reason ?? null, extra.note ?? null, extra.expiryDate ?? null, extra.saleId ?? null],
  );
}
