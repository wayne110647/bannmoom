/**
 * ⚠️ ข้อมูลตัวอย่าง (SAMPLE DATA) — used only when environment.dataSource === 'mock'.
 * The app shows a "ข้อมูลตัวอย่าง" banner whenever this data is in use.
 * Never import this file outside core/data/mock.
 */
import { Ingredient, Product, Recipe, StockTransaction } from '../../models';

const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

type SeedIngredient = Omit<Ingredient, 'updatedAt'>;

export const SEED_INGREDIENTS: SeedIngredient[] = [
  { id: 'ing-flour', name: 'แป้งสาลีอเนกประสงค์', category: 'flour', baseUnit: 'g', displayUnit: 'kg', quantityOnHand: 2500, minQuantity: 1000, avgCostPerBaseUnit: 0.032, nearestExpiry: daysFromNow(90) },
  { id: 'ing-sugar', name: 'น้ำตาลทราย', category: 'sugar', baseUnit: 'g', displayUnit: 'kg', quantityOnHand: 1200, minQuantity: 1000, avgCostPerBaseUnit: 0.028, nearestExpiry: null },
  { id: 'ing-butter', name: 'เนยจืด', category: 'dairy', baseUnit: 'g', displayUnit: 'g', quantityOnHand: 500, minQuantity: 500, avgCostPerBaseUnit: 0.36, nearestExpiry: daysFromNow(20) },
  { id: 'ing-egg', name: 'ไข่ไก่ (เบอร์ 2)', category: 'egg', baseUnit: 'egg', displayUnit: 'egg', quantityOnHand: 12, minQuantity: 10, avgCostPerBaseUnit: 4.5, nearestExpiry: daysFromNow(5) },
  { id: 'ing-milk', name: 'นมสด', category: 'dairy', baseUnit: 'ml', displayUnit: 'l', quantityOnHand: 800, minQuantity: 2000, avgCostPerBaseUnit: 0.05, nearestExpiry: daysFromNow(3) },
  { id: 'ing-choc', name: 'ดาร์กช็อกโกแลต', category: 'chocolate', baseUnit: 'g', displayUnit: 'g', quantityOnHand: 600, minQuantity: 500, avgCostPerBaseUnit: 0.25, nearestExpiry: daysFromNow(180) },
  { id: 'ing-cocoa', name: 'ผงโกโก้', category: 'chocolate', baseUnit: 'g', displayUnit: 'g', quantityOnHand: 300, minQuantity: 200, avgCostPerBaseUnit: 0.4, nearestExpiry: daysFromNow(200) },
  { id: 'ing-chip', name: 'ช็อกโกแลตชิพ', category: 'chocolate', baseUnit: 'g', displayUnit: 'g', quantityOnHand: 400, minQuantity: 200, avgCostPerBaseUnit: 0.3, nearestExpiry: daysFromNow(120) },
  { id: 'ing-blueberry', name: 'บลูเบอร์รี่แช่แข็ง', category: 'fruit', baseUnit: 'g', displayUnit: 'g', quantityOnHand: 0, minQuantity: 200, avgCostPerBaseUnit: 0.6, nearestExpiry: null },
  { id: 'ing-box', name: 'กล่องเค้ก', category: 'packaging', baseUnit: 'piece', displayUnit: 'piece', quantityOnHand: 20, minQuantity: 20, avgCostPerBaseUnit: 5, nearestExpiry: null },
  { id: 'ing-vanilla', name: 'กลิ่นวานิลลา', category: 'other', baseUnit: 'ml', displayUnit: 'ml', quantityOnHand: 60, minQuantity: 30, avgCostPerBaseUnit: null, nearestExpiry: null },
];

/** Every seeded quantity is backed by an "opening" transaction, so history always explains the balance. */
export const SEED_TRANSACTIONS: StockTransaction[] = SEED_INGREDIENTS.map((ing, i) => ({
  id: `tx-seed-${i}`,
  ingredientId: ing.id,
  type: 'opening',
  quantity: ing.quantityOnHand,
  unitCost: ing.avgCostPerBaseUnit,
  balanceAfter: ing.quantityOnHand,
  reason: null,
  note: 'ยอดตั้งต้น (ข้อมูลตัวอย่าง)',
  expiryDate: ing.nearestExpiry,
  createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
}));

export const SEED_RECIPES: Recipe[] = [
  {
    id: 'rcp-brownie', name: 'บราวนี่', productId: 'prd-brownie', yieldQty: 16,
    packagingCost: 12, laborCost: 10, otherCost: 8,
    items: [
      { ingredientId: 'ing-flour', quantity: 200, unit: 'g' },
      { ingredientId: 'ing-butter', quantity: 100, unit: 'g' },
      { ingredientId: 'ing-sugar', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-egg', quantity: 2, unit: 'egg' },
      { ingredientId: 'ing-choc', quantity: 150, unit: 'g' },
    ],
  },
  {
    id: 'rcp-cookie', name: 'คุกกี้ช็อกโกแลตชิพ', productId: 'prd-cookie', yieldQty: 18,
    packagingCost: 54, laborCost: 20, otherCost: 10,
    items: [
      { ingredientId: 'ing-flour', quantity: 0.3, unit: 'kg' },
      { ingredientId: 'ing-butter', quantity: 200, unit: 'g' },
      { ingredientId: 'ing-sugar', quantity: 200, unit: 'g' },
      { ingredientId: 'ing-egg', quantity: 2, unit: 'egg' },
      { ingredientId: 'ing-chip', quantity: 250, unit: 'g' },
    ],
  },
  {
    id: 'rcp-chocake', name: 'เค้กช็อกโกแลต', productId: 'prd-chocake', yieldQty: 12,
    packagingCost: 24, laborCost: 30, otherCost: 15,
    items: [
      { ingredientId: 'ing-flour', quantity: 250, unit: 'g' },
      { ingredientId: 'ing-cocoa', quantity: 60, unit: 'g' },
      { ingredientId: 'ing-sugar', quantity: 250, unit: 'g' },
      { ingredientId: 'ing-egg', quantity: 4, unit: 'egg' },
      { ingredientId: 'ing-butter', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-milk', quantity: 250, unit: 'ml' },
    ],
  },
  {
    id: 'rcp-muffin', name: 'มัฟฟินบลูเบอร์รี่', productId: 'prd-muffin', yieldQty: 8,
    packagingCost: 16, laborCost: 15, otherCost: 5,
    items: [
      { ingredientId: 'ing-flour', quantity: 200, unit: 'g' },
      { ingredientId: 'ing-sugar', quantity: 100, unit: 'g' },
      { ingredientId: 'ing-egg', quantity: 2, unit: 'egg' },
      { ingredientId: 'ing-milk', quantity: 120, unit: 'ml' },
      { ingredientId: 'ing-butter', quantity: 80, unit: 'g' },
      { ingredientId: 'ing-blueberry', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-vanilla', quantity: 5, unit: 'ml' },
    ],
  },
];

type SeedProduct = Omit<Product, 'costPerPiece'>;

export const SEED_PRODUCTS: SeedProduct[] = [
  { id: 'prd-brownie', name: 'บราวนี่', category: 'brownie', description: 'บราวนี่หนึบ ช็อกโกแลตเข้มข้น', imageUrl: null, recipeId: 'rcp-brownie', saleUnit: 'ชิ้น', sellPrice: 25, isActive: true },
  { id: 'prd-cookie', name: 'คุกกี้ช็อกโกแลตชิพ', category: 'cookie', description: 'กล่องละ 2 ชิ้น', imageUrl: null, recipeId: 'rcp-cookie', saleUnit: 'กล่อง', sellPrice: 35, isActive: true },
  { id: 'prd-chocake', name: 'เค้กช็อกโกแลต', category: 'cake', description: 'เค้กช็อกโกแลตหน้านิ่ม', imageUrl: null, recipeId: 'rcp-chocake', saleUnit: 'ชิ้น', sellPrice: 45, isActive: true },
  { id: 'prd-muffin', name: 'มัฟฟินบลูเบอร์รี่', category: 'cake', description: 'มัฟฟินเนื้อนุ่ม บลูเบอร์รี่เต็มคำ', imageUrl: null, recipeId: 'rcp-muffin', saleUnit: 'ชิ้น', sellPrice: 45, isActive: true },
  { id: 'prd-bread', name: 'ขนมปังเนยสด', category: 'bread', description: 'ยังไม่ได้บันทึกสูตร', imageUrl: null, recipeId: null, saleUnit: 'ชิ้น', sellPrice: 20, isActive: true },
  { id: 'prd-basque', name: 'ชีสเค้กหน้าไหม้', category: 'cake', description: 'พักการขายชั่วคราว', imageUrl: null, recipeId: null, saleUnit: 'ชิ้น', sellPrice: 160, isActive: false },
];

/** Sales figures are sample numbers only — orders/sales arrive in Phase 3. */
export const SEED_SALES_TODAY = {
  todaySales: 2480,
  todaySalesChangePct: 12,
  estimatedGrossProfit: 1620,
  orders: { toHandle: 3, pending: 1, preparing: 2 },
  bestSellers: [
    { productId: 'prd-brownie', qtySold: 25 },
    { productId: 'prd-cookie', qtySold: 18 },
    { productId: 'prd-chocake', qtySold: 12 },
    { productId: 'prd-muffin', qtySold: 8 },
  ],
};
