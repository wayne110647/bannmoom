import { UnitCode } from './domain/units';

/* ---------------- Ingredients & stock ---------------- */

export type IngredientCategory = 'flour' | 'sugar' | 'dairy' | 'egg' | 'chocolate' | 'fruit' | 'packaging' | 'other';

export const INGREDIENT_CATEGORIES: { value: IngredientCategory; label: string }[] = [
  { value: 'flour', label: 'แป้ง' },
  { value: 'sugar', label: 'น้ำตาล' },
  { value: 'dairy', label: 'นม/เนย' },
  { value: 'egg', label: 'ไข่' },
  { value: 'chocolate', label: 'ช็อกโกแลต/โกโก้' },
  { value: 'fruit', label: 'ผลไม้' },
  { value: 'packaging', label: 'แพ็กเกจ' },
  { value: 'other', label: 'อื่น ๆ' },
];

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  /** Unit all quantities are stored in (g, ml, egg, piece). */
  baseUnit: UnitCode;
  /** Unit the shop prefers to see (e.g. kg for flour). Same dimension as baseUnit. */
  displayUnit: UnitCode;
  quantityOnHand: number;
  minQuantity: number;
  /** Weighted average cost per base unit. null = never purchased. */
  avgCostPerBaseUnit: number | null;
  nearestExpiry: string | null;
  updatedAt: string;
}

export type StockTxType = 'opening' | 'stock_in' | 'usage' | 'adjustment' | 'sale' | 'sale_reversal';

export const STOCK_TX_LABEL: Record<StockTxType, string> = {
  opening: 'ยอดยกมา',
  stock_in: 'รับเข้า',
  usage: 'เบิกใช้',
  adjustment: 'ปรับยอด',
  sale: 'ตัดจากการขาย',
  sale_reversal: 'คืนจากการยกเลิก',
};

export interface StockTransaction {
  id: string;
  ingredientId: string;
  type: StockTxType;
  /** Signed change in base unit (+ in, − out). */
  quantity: number;
  unitCost: number | null;
  balanceAfter: number;
  reason: string | null;
  note: string | null;
  expiryDate: string | null;
  createdAt: string;
}

export interface StockInInput {
  packSize: number;
  packUnit: UnitCode;
  packCount: number;
  pricePerPack: number;
  expiryDate: string | null;
  note: string | null;
}

export interface UsageInput {
  quantity: number;
  unit: UnitCode;
  note: string | null;
}

export interface AdjustmentInput {
  /** What was actually counted, in `unit`. */
  countedQuantity: number;
  unit: UnitCode;
  reason: string;
  note: string | null;
}

export const ADJUSTMENT_REASONS = ['นับสต็อกจริง', 'ของเสีย/หมดอายุ', 'ชำรุดเสียหาย', 'บันทึกผิดพลาด', 'อื่น ๆ'];

export interface IngredientInput {
  name: string;
  category: IngredientCategory;
  displayUnit: UnitCode;
  /** In displayUnit. */
  minQuantity: number;
}

export interface NewIngredientInput extends IngredientInput {
  /** Optional opening stock — recorded as an "opening" transaction, never as a bare number. */
  opening: StockInInput | null;
}

/* ---------------- Products & recipes ---------------- */

export type ProductCategory = 'cake' | 'cookie' | 'brownie' | 'bread' | 'other';

export const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'cake', label: 'เค้ก' },
  { value: 'cookie', label: 'คุกกี้' },
  { value: 'brownie', label: 'บราวนี่' },
  { value: 'bread', label: 'ขนมปัง' },
  { value: 'other', label: 'อื่น ๆ' },
];

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  imageUrl: string | null;
  recipeId: string | null;
  /** ชิ้น / กล่อง / ปอนด์ */
  saleUnit: string;
  sellPrice: number;
  isActive: boolean;
  /** Calculated from the recipe on the server. null = no recipe or missing ingredient cost. */
  costPerPiece: number | null;
}

export interface RecipeItem {
  ingredientId: string;
  quantity: number;
  unit: UnitCode;
}

export interface Recipe {
  id: string;
  name: string;
  productId: string | null;
  yieldQty: number;
  items: RecipeItem[];
  /** Default extra costs per batch. */
  packagingCost: number;
  laborCost: number;
  otherCost: number;
}

/** A menu item and its recipe, created/edited together in one form. */
export interface MenuRecipeInput {
  name: string;
  category: ProductCategory;
  saleUnit: string;
  sellPrice: number;
  yieldQty: number;
  packagingCost: number;
  laborCost: number;
  otherCost: number;
  items: RecipeItem[];
}

export interface CostCalculationInput {
  recipeId: string;
  packagingCost: number;
  laborCost: number;
  otherCost: number;
  yieldQty: number;
  sellPrice: number | null;
}

export interface SavedCostCalculation extends CostCalculationInput {
  id: string;
  totalCost: number;
  costPerPiece: number;
  createdAt: string;
}

/* ---------------- Sales & money ---------------- */

export interface SaleItemInput {
  productId: string;
  quantity: number;
}

/** One "บันทึกยอดขาย" entry — often a whole day's count. Prices come from the menu, never from the client. */
export interface SaleInput {
  /** Shop date, YYYY-MM-DD (Thai time). */
  soldOn: string;
  items: SaleItemInput[];
  note: string | null;
}

export interface SaleItem {
  productId: string;
  name: string;
  saleUnit: string;
  quantity: number;
  unitPrice: number;
  /** Recipe cost per unit at sale time; null = menu had no recipe or ingredient prices were missing. */
  unitCost: number | null;
}

export interface Sale {
  id: string;
  soldOn: string;
  total: number;
  note: string | null;
  createdAt: string;
  items: SaleItem[];
}

/** Stock the app thought it had was less than the sale used; it was taken down to 0. */
export interface StockShortage {
  ingredientId: string;
  name: string;
  /** In the ingredient's base unit. */
  needed: number;
  available: number;
  baseUnit: UnitCode;
  displayUnit: UnitCode;
}

export interface SaleResult {
  sale: Sale;
  shortages: StockShortage[];
}

export type ExpenseCategory = 'utilities' | 'packaging' | 'ingredients' | 'delivery' | 'equipment' | 'other';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'utilities', label: 'ค่าแก๊ส/น้ำ/ไฟ' },
  { value: 'packaging', label: 'ถุง/กล่อง/สติกเกอร์' },
  { value: 'ingredients', label: 'ซื้อของ (ไม่ได้ลงสต็อก)' },
  { value: 'delivery', label: 'ค่าส่ง/ค่าเดินทาง' },
  { value: 'equipment', label: 'อุปกรณ์' },
  { value: 'other', label: 'อื่น ๆ' },
];

export interface ExpenseInput {
  spentOn: string;
  category: ExpenseCategory;
  amount: number;
  note: string | null;
}

export interface Expense extends ExpenseInput {
  id: string;
  createdAt: string;
}

/** One line of the income/expense list. `amount` is + for money in, − for money out. */
export interface LedgerEntry {
  kind: 'sale' | 'expense' | 'purchase';
  id: string;
  date: string;
  createdAt: string;
  title: string;
  detail: string | null;
  amount: number;
}

export interface Ledger {
  from: string;
  to: string;
  /** Money in from sales. */
  income: number;
  /** Ingredients bought through "รับเข้า" (stock in). */
  purchases: number;
  /** Other expenses entered by hand. */
  expenses: number;
  /** income − purchases − expenses: what's actually left. */
  net: number;
  /** income − recipe cost of what was sold (only lines whose cost is known). */
  grossProfit: number;
  /** Some sold items had no recipe cost, so grossProfit leaves them out. */
  costIncomplete: boolean;
  entries: LedgerEntry[];
}

/* ---------------- Dashboard ---------------- */

export interface DashboardSummary {
  todaySales: number;
  todaySalesChangePct: number | null;
  /** Gross profit = sales − recipe cost of what was sold (ingredients + packaging), before other expenses. */
  estimatedGrossProfit: number;
  /** Items sold today without a known recipe cost (left out of the profit). */
  costIncomplete: boolean;
  /** Units sold today, and whether anything was recorded yet. */
  todayUnitsSold: number;
  /** Money out today: stock-in purchases + other expenses. */
  todayExpenses: number;
  lowStock: { count: number; names: string[] };
  expiringSoon: { count: number; names: string[] };
  bestSellers: { productId: string; name: string; category: ProductCategory; imageUrl: string | null; saleUnit: string; sellPrice: number; qtySold: number }[];
}
