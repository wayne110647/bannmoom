import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { Db, TYPE_PARSERS } from '../src/db';

/** Real Postgres (PGlite, in-process) with the real schema, fresh for every test. */
async function setup() {
  const pg = await PGlite.create({ parsers: TYPE_PARSERS });
  await pg.exec(await readFile(fileURLToPath(new URL('../db/schema.sql', import.meta.url).href), 'utf8'));
  const db: Db = {
    query: async (text, values) => (await pg.query<any>(text, values)).rows,
    transaction: (fn) => pg.transaction((tx) => fn({ query: async (text, values) => (await tx.query<any>(text, values)).rows })),
  };
  const app = createApp(async () => ({ db, close: async () => {} }));
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(`/api${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, json: (text ? JSON.parse(text) : null) as any };
  };
  return { call, pg };
}

type Api = Awaited<ReturnType<typeof setup>>['call'];

const opening = (packSize: number, packUnit: string, pricePerPack: number, expiryDate: string | null = null) => ({
  packSize, packUnit, packCount: 1, pricePerPack, expiryDate, note: null,
});

async function addIngredient(call: Api, name: string, displayUnit: string, open: ReturnType<typeof opening> | null, minQuantity = 0) {
  const res = await call('POST', '/ingredients', { name, category: 'other', displayUnit, minQuantity, opening: open });
  expect(res.status).toBe(201);
  return res.json;
}

describe('ingredients & stock', () => {
  let call: Api;
  beforeEach(async () => ({ call } = await setup()));

  it('creates an ingredient with opening stock in base units and cost per base unit', async () => {
    const flour = await addIngredient(call, 'แป้ง', 'kg', opening(1, 'kg', 32, '2030-01-31'));
    expect(flour).toMatchObject({ baseUnit: 'g', displayUnit: 'kg', quantityOnHand: 1000, avgCostPerBaseUnit: 0.032, nearestExpiry: '2030-01-31' });

    const tx = await call('GET', `/ingredients/${flour.id}/transactions`);
    expect(tx.json).toHaveLength(1);
    expect(tx.json[0]).toMatchObject({ type: 'opening', quantity: 1000, balanceAfter: 1000, unitCost: 0.032 });
  });

  it('stock-in updates the weighted average cost', async () => {
    const butter = await addIngredient(call, 'เนย', 'g', opening(500, 'g', 180));
    const res = await call('POST', `/ingredients/${butter.id}/stock-in`, opening(1, 'kg', 400));
    expect(res.status).toBe(200);
    // (500 × 0.36 + 1000 × 0.40) ÷ 1500
    expect(res.json.avgCostPerBaseUnit).toBeCloseTo(0.386667, 6);
    expect(res.json.quantityOnHand).toBe(1500);
  });

  it('refuses usage beyond stock and leaves nothing half-written', async () => {
    const egg = await addIngredient(call, 'ไข่', 'egg', opening(10, 'egg', 45));
    const res = await call('POST', `/ingredients/${egg.id}/usages`, { quantity: 11, unit: 'egg', note: null });
    expect(res.status).toBe(409);
    expect(res.json.message).toContain('สต็อกไม่พอ');

    expect((await call('GET', `/ingredients/${egg.id}`)).json.quantityOnHand).toBe(10);
    expect((await call('GET', `/ingredients/${egg.id}/transactions`)).json).toHaveLength(1);

    const ok = await call('POST', `/ingredients/${egg.id}/usages`, { quantity: 4, unit: 'egg', note: 'ทำเค้ก' });
    expect(ok.json.quantityOnHand).toBe(6);
  });

  it('adjusts to the counted amount and records the reason', async () => {
    const milk = await addIngredient(call, 'นม', 'l', opening(2, 'l', 100));
    const res = await call('POST', `/ingredients/${milk.id}/adjustments`, { countedQuantity: 1.5, unit: 'l', reason: 'นับสต็อกจริง', note: null });
    expect(res.json.quantityOnHand).toBe(1500);
    const [latest] = (await call('GET', `/ingredients/${milk.id}/transactions`)).json;
    expect(latest).toMatchObject({ type: 'adjustment', quantity: -500, reason: 'นับสต็อกจริง' });
  });

  it('rejects duplicate names, wrong units, bad bodies and unknown ids with Thai messages', async () => {
    const sugar = await addIngredient(call, 'น้ำตาล', 'kg', null);
    const dup = await call('POST', '/ingredients', { name: 'น้ำตาล', category: 'sugar', displayUnit: 'g', minQuantity: 0, opening: null });
    expect(dup.status).toBe(409);
    expect(dup.json.message).toContain('มีวัตถุดิบชื่อ');

    const wrongUnit = await call('POST', `/ingredients/${sugar.id}/stock-in`, opening(2, 'egg', 10));
    expect(wrongUnit.status).toBe(400);

    const bad = await call('POST', '/ingredients', { name: '', category: 'nope' });
    expect(bad.status).toBe(400);
    expect(bad.json.message).toBe('ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');

    expect((await call('GET', '/ingredients/missing')).status).toBe(404);
  });
});

describe('recipes, menu & cost', () => {
  let call: Api;
  let flour: any, butter: any, vanilla: any;
  beforeEach(async () => {
    ({ call } = await setup());
    flour = await addIngredient(call, 'แป้ง', 'kg', opening(1, 'kg', 32));
    butter = await addIngredient(call, 'เนย', 'g', opening(500, 'g', 180), 1000);
    vanilla = await addIngredient(call, 'วานิลลา', 'ml', null);
  });

  const cookie = (overrides: object = {}) => ({
    name: 'คุกกี้เนยสด', category: 'cookie', saleUnit: 'ชิ้น', sellPrice: 30, yieldQty: 10,
    packagingCost: 10, laborCost: 0, otherCost: 0,
    items: [
      { ingredientId: flour.id, quantity: 0.25, unit: 'kg' },
      { ingredientId: butter.id, quantity: 100, unit: 'g' },
    ],
    ...overrides,
  });

  it('creates a menu item with its recipe and costs it per piece', async () => {
    const created = await call('POST', '/recipes', cookie());
    expect(created.status).toBe(201);
    expect(created.json.items).toEqual([
      { ingredientId: flour.id, quantity: 0.25, unit: 'kg' },
      { ingredientId: butter.id, quantity: 100, unit: 'g' },
    ]);

    const [product] = (await call('GET', '/products')).json;
    // 250 g × 0.032 + 100 g × 0.36 + 10 packaging = 54 → ÷ 10
    expect(product).toMatchObject({ name: 'คุกกี้เนยสด', recipeId: created.json.id, sellPrice: 30, costPerPiece: 5.4, isActive: true });
  });

  it('updates the recipe and its menu item together', async () => {
    const { json: r } = await call('POST', '/recipes', cookie());
    const res = await call('PUT', `/recipes/${r.id}`, cookie({ name: 'คุกกี้เนยสดกล่อง', saleUnit: 'กล่อง', sellPrice: 55, yieldQty: 5, items: [{ ingredientId: butter.id, quantity: 200, unit: 'g' }] }));
    expect(res.status).toBe(200);
    expect(res.json.items).toHaveLength(1);

    const [product] = (await call('GET', '/products')).json;
    // 200 × 0.36 + 10 = 82 → ÷ 5
    expect(product).toMatchObject({ name: 'คุกกี้เนยสดกล่อง', saleUnit: 'กล่อง', sellPrice: 55, costPerPiece: 16.4 });
  });

  it('rejects incompatible units, duplicate lines and duplicate names', async () => {
    expect((await call('POST', '/recipes', cookie({ items: [{ ingredientId: flour.id, quantity: 2, unit: 'egg' }] }))).status).toBe(400);
    const dupLine = await call('POST', '/recipes', cookie({ items: [{ ingredientId: flour.id, quantity: 1, unit: 'g' }, { ingredientId: flour.id, quantity: 2, unit: 'g' }] }));
    expect(dupLine.json.message).toContain('ซ้ำ');
    await call('POST', '/recipes', cookie());
    const dupName = await call('POST', '/recipes', cookie());
    expect(dupName.status).toBe(409);
    expect((await call('GET', '/products')).json).toHaveLength(1);
  });

  it('shows no cost while an ingredient has no purchase price, and refuses to save that calculation', async () => {
    const { json: r } = await call('POST', '/recipes', cookie({ items: [{ ingredientId: vanilla.id, quantity: 5, unit: 'ml' }] }));
    expect((await call('GET', '/products')).json[0].costPerPiece).toBeNull();

    const save = await call('POST', '/cost-calculations', { recipeId: r.id, packagingCost: 0, laborCost: 0, otherCost: 0, yieldQty: 10, sellPrice: 30 });
    expect(save.status).toBe(400);
    expect(save.json.message).toContain('ยังไม่มีราคาซื้อ');
  });

  it('saves a cost calculation with the overridden extras', async () => {
    const { json: r } = await call('POST', '/recipes', cookie());
    const res = await call('POST', '/cost-calculations', { recipeId: r.id, packagingCost: 20, laborCost: 6, otherCost: 0, yieldQty: 12, sellPrice: 30 });
    expect(res.status).toBe(201);
    // 44 + 26 = 70 → ÷ 12 = 5.833…
    expect(res.json).toMatchObject({ totalCost: 70, costPerPiece: 5.83 });
  });

  it('deletes a menu item with its recipe, frees the name, and undo brings it back', async () => {
    const { json: r } = await call('POST', '/recipes', cookie());
    const productId = r.productId;
    expect((await call('DELETE', `/products/${productId}`)).status).toBe(204);
    expect((await call('GET', '/products')).json).toHaveLength(0);
    expect((await call('GET', '/recipes')).json).toHaveLength(0);
    expect((await call('GET', `/recipes/${r.id}`)).status).toBe(404);

    expect((await call('POST', `/products/${productId}/restore`)).status).toBe(204);
    expect((await call('GET', '/products')).json[0]).toMatchObject({ id: productId, recipeId: r.id, costPerPiece: 5.4 });

    // Once deleted again, the same name can be used for a new menu — and then the old one can't come back.
    await call('DELETE', `/products/${productId}`);
    expect((await call('POST', '/recipes', cookie())).status).toBe(201);
    const blocked = await call('POST', `/products/${productId}/restore`);
    expect(blocked.status).toBe(409);
    expect(blocked.json.message).toContain('ชื่อเดียวกัน');
  });

  it('will not delete an ingredient a menu still uses, and says which menu', async () => {
    await call('POST', '/recipes', cookie());
    const res = await call('DELETE', `/ingredients/${butter.id}`);
    expect(res.status).toBe(409);
    expect(res.json.message).toContain('"คุกกี้เนยสด"');
    expect((await call('GET', `/ingredients/${butter.id}`)).status).toBe(200);
  });

  it('deletes an unused ingredient but keeps its history for undo', async () => {
    expect((await call('DELETE', `/ingredients/${flour.id}`)).status).toBe(204);
    expect((await call('GET', '/ingredients')).json.map((i: any) => i.name)).not.toContain('แป้ง');
    expect((await call('GET', `/ingredients/${flour.id}`)).status).toBe(404);
    // A deleted ingredient can't be put into a recipe.
    expect((await call('POST', '/recipes', cookie())).status).toBe(400);

    const restored = await call('POST', `/ingredients/${flour.id}/restore`);
    expect(restored.json).toMatchObject({ name: 'แป้ง', quantityOnHand: 1000, avgCostPerBaseUnit: 0.032 });
    expect((await call('GET', `/ingredients/${flour.id}/transactions`)).json).toHaveLength(1);
  });

  it('summarises low stock without inventing sales figures', async () => {
    const { json } = await call('GET', '/reports/summary');
    expect(json.lowStock).toEqual({ count: 2, names: expect.arrayContaining(['เนย', 'วานิลลา']) });
    expect(json).toMatchObject({ todaySales: 0, todaySalesChangePct: null, bestSellers: [] });
  });
});
