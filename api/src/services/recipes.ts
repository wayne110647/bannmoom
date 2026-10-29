import { CostResult, calculateCost } from '../../../frontend/src/app/core/domain/cost';
import { isCompatible } from '../../../frontend/src/app/core/domain/units';
import type {
  CostCalculationInput, Ingredient, MenuRecipeInput, Product, Recipe, SavedCostCalculation,
} from '../../../frontend/src/app/core/models';
import { Db, Sql, isUniqueViolation } from '../db';
import { badRequest, conflict, notFound } from '../errors';
import { listIngredients } from './ingredients';

const RECIPE_SELECT = `
  SELECT r.id, r.name, r.product_id AS "productId", r.yield_qty AS "yieldQty",
         r.packaging_cost AS "packagingCost", r.labor_cost AS "laborCost", r.other_cost AS "otherCost",
         COALESCE(
           json_agg(json_build_object('ingredientId', i.ingredient_id, 'quantity', i.quantity, 'unit', i.unit)
                    ORDER BY i.position) FILTER (WHERE i.recipe_id IS NOT NULL),
           '[]'
         ) AS items
  FROM recipes r LEFT JOIN recipe_items i ON i.recipe_id = r.id
  WHERE r.archived_at IS NULL`;

/* ---------------- Recipes ---------------- */

export async function listRecipes(sql: Sql): Promise<Recipe[]> {
  const rows = await sql.query<Recipe>(`${RECIPE_SELECT} GROUP BY r.id`);
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

export async function getRecipe(sql: Sql, id: string): Promise<Recipe> {
  const [row] = await sql.query<Recipe>(`${RECIPE_SELECT} AND r.id = $1 GROUP BY r.id`, [id]);
  if (!row) throw notFound('ไม่พบสูตรนี้');
  return row;
}

/** Creates the menu item (product) and its recipe together. */
export async function createRecipe(db: Db, input: MenuRecipeInput): Promise<Recipe> {
  return saveRecipe(db, input, async (tx) => {
    const productId = crypto.randomUUID();
    const recipeId = crypto.randomUUID();
    await tx.query(
      `INSERT INTO products (id, name, category, sale_unit, sell_price) VALUES ($1, $2, $3, $4, $5)`,
      [productId, input.name, input.category, input.saleUnit, input.sellPrice],
    );
    await tx.query(
      `INSERT INTO recipes (id, name, product_id, yield_qty, packaging_cost, labor_cost, other_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [recipeId, input.name, productId, input.yieldQty, input.packagingCost, input.laborCost, input.otherCost],
    );
    return recipeId;
  });
}

export async function updateRecipe(db: Db, id: string, input: MenuRecipeInput): Promise<Recipe> {
  return saveRecipe(db, input, async (tx) => {
    const [row] = await tx.query<{ productId: string | null }>(
      `UPDATE recipes SET name = $2, yield_qty = $3, packaging_cost = $4, labor_cost = $5, other_cost = $6
       WHERE id = $1 AND archived_at IS NULL RETURNING product_id AS "productId"`,
      [id, input.name, input.yieldQty, input.packagingCost, input.laborCost, input.otherCost],
    );
    if (!row) throw notFound('ไม่พบสูตรนี้');
    if (row.productId) {
      await tx.query(
        `UPDATE products SET name = $2, category = $3, sale_unit = $4, sell_price = $5 WHERE id = $1`,
        [row.productId, input.name, input.category, input.saleUnit, input.sellPrice],
      );
    }
    await tx.query(`DELETE FROM recipe_items WHERE recipe_id = $1`, [id]);
    return id;
  });
}

/** Shared by create/update: checks the ingredient lines, writes them, and maps the duplicate-name error. */
async function saveRecipe(db: Db, input: MenuRecipeInput, writeHeader: (tx: Sql) => Promise<string>): Promise<Recipe> {
  try {
    return await db.transaction(async (tx) => {
      await checkItems(tx, input);
      const recipeId = await writeHeader(tx);
      for (const [position, item] of input.items.entries()) {
        await tx.query(
          `INSERT INTO recipe_items (recipe_id, ingredient_id, position, quantity, unit) VALUES ($1, $2, $3, $4, $5)`,
          [recipeId, item.ingredientId, position, item.quantity, item.unit],
        );
      }
      return getRecipe(tx, recipeId);
    });
  } catch (e) {
    if (isUniqueViolation(e, 'recipes_name_active_key')) throw conflict(`มีเมนูชื่อ "${input.name}" อยู่แล้ว`);
    throw e;
  }
}

async function checkItems(tx: Sql, input: MenuRecipeInput) {
  const ids = input.items.map((i) => i.ingredientId);
  const found = await tx.query<{ id: string; name: string; baseUnit: Ingredient['baseUnit'] }>(
    `SELECT id, name, base_unit AS "baseUnit" FROM ingredients WHERE id = ANY($1) AND archived_at IS NULL`,
    [ids],
  );
  const byId = new Map(found.map((i) => [i.id, i]));
  const seen = new Set<string>();
  for (const item of input.items) {
    const ing = byId.get(item.ingredientId);
    if (!ing) throw badRequest('มีวัตถุดิบในสูตรที่ไม่อยู่ในระบบแล้ว กรุณาเลือกใหม่');
    if (seen.has(ing.id)) throw badRequest(`ใส่ "${ing.name}" ซ้ำ — รวมเป็นบรรทัดเดียว`);
    seen.add(ing.id);
    if (!isCompatible(item.unit, ing.baseUnit)) throw badRequest(`หน่วยของ "${ing.name}" ไม่ถูกต้อง`);
  }
}

/* ---------------- Delete (archive) menu items ---------------- */

/** Archives the menu item together with its recipe; undo brings both back. */
export function archiveProduct(db: Db, id: string): Promise<void> {
  return db.transaction(async (tx) => {
    const [row] = await tx.query(
      `UPDATE products SET archived_at = now() WHERE id = $1 AND archived_at IS NULL RETURNING id`,
      [id],
    );
    if (!row) throw notFound('ไม่พบเมนูนี้ อาจถูกลบไปแล้ว');
    await tx.query(`UPDATE recipes SET archived_at = now() WHERE product_id = $1 AND archived_at IS NULL`, [id]);
  });
}

export async function restoreProduct(db: Db, id: string): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx.query(
        `UPDATE products SET archived_at = NULL WHERE id = $1 AND archived_at IS NOT NULL RETURNING id`,
        [id],
      );
      if (!row) throw notFound('ไม่พบเมนูที่ลบไป');
      await tx.query(`UPDATE recipes SET archived_at = NULL WHERE product_id = $1`, [id]);
    });
  } catch (e) {
    if (isUniqueViolation(e, 'recipes_name_active_key')) {
      throw conflict('กู้คืนไม่ได้ เพราะมีเมนูชื่อเดียวกันเพิ่มเข้ามาแล้ว');
    }
    throw e;
  }
}

/* ---------------- Cost ---------------- */

function costOf(
  recipe: Recipe,
  ingredients: Map<string, Ingredient>,
  overrides: Partial<Pick<CostCalculationInput, 'packagingCost' | 'laborCost' | 'otherCost' | 'yieldQty' | 'sellPrice'>> = {},
): CostResult {
  return calculateCost({
    lines: recipe.items.map((item) => {
      const ing = ingredients.get(item.ingredientId);
      return {
        ...item,
        name: ing?.name ?? 'วัตถุดิบที่ถูกลบ',
        baseUnit: ing?.baseUnit ?? item.unit,
        costPerBaseUnit: ing?.avgCostPerBaseUnit ?? null,
      };
    }),
    packagingCost: recipe.packagingCost,
    laborCost: recipe.laborCost,
    otherCost: recipe.otherCost,
    yieldQty: recipe.yieldQty,
    sellPrice: null,
    ...overrides,
  });
}

export async function listProducts(sql: Sql): Promise<Product[]> {
  const [products, recipes, ingredients] = await Promise.all([
    sql.query<Omit<Product, 'costPerPiece'>>(
      `SELECT p.id, p.name, p.category, p.description, p.image_url AS "imageUrl", r.id AS "recipeId",
              p.sale_unit AS "saleUnit", p.sell_price AS "sellPrice", p.is_active AS "isActive"
       FROM products p LEFT JOIN recipes r ON r.product_id = p.id
       WHERE p.archived_at IS NULL
       ORDER BY p.created_at`,
    ),
    listRecipes(sql),
    listIngredients(sql),
  ]);
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  return products.map((p) => {
    const recipe = p.recipeId ? recipeById.get(p.recipeId) : undefined;
    return { ...p, costPerPiece: recipe ? costOf(recipe, ingById).perPiece : null };
  });
}

export async function saveCostCalculation(db: Db, input: CostCalculationInput): Promise<SavedCostCalculation> {
  const recipe = await getRecipe(db, input.recipeId);
  const ingredients = new Map((await listIngredients(db)).map((i) => [i.id, i]));
  const result = costOf(recipe, ingredients, input);
  if (!result.complete) throw badRequest(result.problems.join(', '));
  const [saved] = await db.query<SavedCostCalculation>(
    `INSERT INTO cost_calculations
       (id, recipe_id, packaging_cost, labor_cost, other_cost, yield_qty, sell_price, total_cost, cost_per_piece)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, recipe_id AS "recipeId", packaging_cost AS "packagingCost", labor_cost AS "laborCost",
               other_cost AS "otherCost", yield_qty AS "yieldQty", sell_price AS "sellPrice",
               total_cost AS "totalCost", cost_per_piece AS "costPerPiece", created_at AS "createdAt"`,
    [crypto.randomUUID(), input.recipeId, input.packagingCost, input.laborCost, input.otherCost, input.yieldQty,
      input.sellPrice, result.total, result.perPiece],
  );
  return saved;
}
