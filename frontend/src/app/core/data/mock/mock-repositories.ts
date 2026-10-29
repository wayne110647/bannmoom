/**
 * ⚠️ MOCK implementations — in-memory, reset on page reload.
 * They follow the same business rules the real API must enforce
 * (history for every stock change, no negative stock, weighted average cost)
 * so the UI behaves realistically before the backend exists.
 */
import { Injectable } from '@angular/core';
import { Observable, defer, delay, of, throwError } from 'rxjs';
import { calculateCost } from '../../domain/cost';
import { dec, mul, sub, toNumber } from '../../domain/decimal';
import { costPerBaseUnit, isExpiringSoon, stockLevel, weightedAverageCost } from '../../domain/inventory';
import { baseUnitOf, convert, isCompatible, toBase, unitLabel } from '../../domain/units';
import { AppError } from '../../errors';
import {
  AdjustmentInput, CostCalculationInput, DashboardSummary, Ingredient, IngredientInput, NewIngredientInput,
  MenuRecipeInput, Product, Recipe, SavedCostCalculation, StockInInput, StockTransaction, StockTxType, UsageInput,
} from '../../models';
import {
  CostCalculationRepository, DashboardRepository, IngredientRepository, ProductRepository, RecipeRepository,
} from '../repositories';
import { SEED_INGREDIENTS, SEED_PRODUCTS, SEED_RECIPES, SEED_SALES_TODAY, SEED_TRANSACTIONS } from './mock-seed';

const LATENCY_MS = 300;
const EXPIRY_WARNING_DAYS = 7;

/** Simulate a network call: async, cloned result, errors surface as Observable errors. */
function respond<T>(fn: () => T): Observable<T> {
  return defer(() => {
    try {
      return of(structuredClone(fn()));
    } catch (e) {
      return throwError(() => e);
    }
  }).pipe(delay(LATENCY_MS));
}

const now = () => new Date().toISOString();
let seq = 1000;
const newId = (prefix: string) => `${prefix}-${++seq}`;

@Injectable({ providedIn: 'root' })
export class MockDb {
  ingredients: Ingredient[] = SEED_INGREDIENTS.map((i) => ({ ...i, updatedAt: now() }));
  transactions: StockTransaction[] = [...SEED_TRANSACTIONS];
  recipes: Recipe[] = structuredClone(SEED_RECIPES);
  products = structuredClone(SEED_PRODUCTS);
  calculations: SavedCostCalculation[] = [];
  /** Deleted items wait here so undo can put them back, like the API's archived rows. */
  archived = { ingredients: [] as Ingredient[], products: [] as typeof SEED_PRODUCTS, recipes: [] as Recipe[] };

  ingredient(id: string): Ingredient {
    const found = this.ingredients.find((i) => i.id === id);
    if (!found) throw new AppError('ไม่พบวัตถุดิบนี้ อาจถูกลบไปแล้ว');
    return found;
  }

  recipe(id: string): Recipe {
    const found = this.recipes.find((r) => r.id === id);
    if (!found) throw new AppError('ไม่พบสูตรนี้');
    return found;
  }

  /** The only way stock quantity may change: always writes a transaction. */
  move(ing: Ingredient, type: StockTxType, deltaBase: number, extra: Partial<StockTransaction> = {}) {
    const balance = toNumber(dec(ing.quantityOnHand) + dec(deltaBase));
    if (balance < 0) {
      const left = toNumber(convert(dec(ing.quantityOnHand), ing.baseUnit, ing.displayUnit));
      throw new AppError(`สต็อกไม่พอ — ${ing.name} คงเหลือ ${left} ${unitLabel(ing.displayUnit)}`);
    }
    ing.quantityOnHand = balance;
    ing.updatedAt = now();
    this.transactions.unshift({
      id: newId('tx'), ingredientId: ing.id, type, quantity: deltaBase, unitCost: ing.avgCostPerBaseUnit,
      balanceAfter: balance, reason: null, note: null, expiryDate: null, createdAt: now(), ...extra,
    });
  }

  receive(ing: Ingredient, input: StockInInput, type: StockTxType) {
    if (!isCompatible(input.packUnit, ing.baseUnit)) {
      throw new AppError('หน่วยที่รับเข้าไม่ตรงกับหน่วยของวัตถุดิบ');
    }
    const baseQty = toNumber(mul(toBase(dec(input.packSize), input.packUnit), dec(input.packCount)));
    if (!(baseQty > 0)) throw new AppError('จำนวนที่รับเข้าต้องมากกว่า 0');
    if (input.pricePerPack < 0) throw new AppError('ราคาต้องไม่ติดลบ');
    const totalPrice = toNumber(mul(dec(input.pricePerPack), dec(input.packCount)));
    const unitCost = costPerBaseUnit(totalPrice, baseQty);
    ing.avgCostPerBaseUnit = weightedAverageCost(ing.quantityOnHand, ing.avgCostPerBaseUnit, baseQty, unitCost);
    if (input.expiryDate && (!ing.nearestExpiry || input.expiryDate < ing.nearestExpiry)) {
      ing.nearestExpiry = input.expiryDate;
    }
    this.move(ing, type, baseQty, { unitCost, expiryDate: input.expiryDate, note: input.note });
  }

  productCost(recipeId: string | null): number | null {
    if (!recipeId) return null;
    const recipe = this.recipe(recipeId);
    const result = calculateCost({
      lines: recipe.items.map((item) => {
        const ing = this.ingredient(item.ingredientId);
        return { ...item, name: ing.name, baseUnit: ing.baseUnit, costPerBaseUnit: ing.avgCostPerBaseUnit };
      }),
      packagingCost: recipe.packagingCost,
      laborCost: recipe.laborCost,
      otherCost: recipe.otherCost,
      yieldQty: recipe.yieldQty,
      sellPrice: null,
    });
    return result.perPiece;
  }
}

@Injectable()
export class MockIngredientRepository extends IngredientRepository {
  constructor(private db: MockDb) { super(); }

  list() {
    return respond(() => [...this.db.ingredients].sort((a, b) => a.name.localeCompare(b.name, 'th')));
  }

  get(id: string) {
    return respond(() => this.db.ingredient(id));
  }

  create(input: NewIngredientInput) {
    return respond(() => {
      const name = input.name.trim();
      if (this.db.ingredients.some((i) => i.name === name)) throw new AppError(`มีวัตถุดิบชื่อ "${name}" อยู่แล้ว`);
      const baseUnit = baseUnitOf(input.displayUnit);
      const ing: Ingredient = {
        id: newId('ing'), name, category: input.category, baseUnit, displayUnit: input.displayUnit,
        quantityOnHand: 0, minQuantity: toNumber(toBase(dec(input.minQuantity), input.displayUnit)),
        avgCostPerBaseUnit: null, nearestExpiry: null, updatedAt: now(),
      };
      if (input.opening) this.db.receive(ing, input.opening, 'opening');
      this.db.ingredients.push(ing);
      return ing;
    });
  }

  update(id: string, input: IngredientInput) {
    return respond(() => {
      const ing = this.db.ingredient(id);
      if (!isCompatible(input.displayUnit, ing.baseUnit)) {
        throw new AppError('เปลี่ยนเป็นหน่วยคนละประเภทไม่ได้ เพราะจะทำให้ยอดคงเหลือผิด');
      }
      Object.assign(ing, {
        name: input.name.trim(), category: input.category, displayUnit: input.displayUnit,
        minQuantity: toNumber(toBase(dec(input.minQuantity), input.displayUnit)), updatedAt: now(),
      });
      return ing;
    });
  }

  transactions(id: string) {
    return respond(() => this.db.transactions.filter((t) => t.ingredientId === id));
  }

  stockIn(id: string, input: StockInInput) {
    return respond(() => {
      const ing = this.db.ingredient(id);
      this.db.receive(ing, input, 'stock_in');
      return ing;
    });
  }

  usage(id: string, input: UsageInput) {
    return respond(() => {
      const ing = this.db.ingredient(id);
      const qty = toNumber(convert(dec(input.quantity), input.unit, ing.baseUnit));
      if (!(qty > 0)) throw new AppError('จำนวนที่เบิกต้องมากกว่า 0');
      this.db.move(ing, 'usage', -qty, { note: input.note });
      return ing;
    });
  }

  adjust(id: string, input: AdjustmentInput) {
    return respond(() => {
      const ing = this.db.ingredient(id);
      if (!input.reason?.trim()) throw new AppError('กรุณาระบุเหตุผลการปรับยอด');
      const counted = convert(dec(input.countedQuantity), input.unit, ing.baseUnit);
      const delta = toNumber(sub(counted, dec(ing.quantityOnHand)));
      if (delta === 0) throw new AppError('ยอดที่นับได้เท่ากับยอดในระบบ ไม่ต้องปรับ');
      this.db.move(ing, 'adjustment', delta, { reason: input.reason, note: input.note });
      return ing;
    });
  }

  remove(id: string) {
    return respond<void>(() => {
      const ing = this.db.ingredient(id);
      const usedBy = this.db.recipes.filter((r) => r.items.some((i) => i.ingredientId === id));
      if (usedBy.length) {
        throw new AppError(`ยังใช้อยู่ในเมนู ${usedBy.map((r) => `"${r.name}"`).join(', ')} — เอาออกจากสูตรก่อนแล้วค่อยลบ`);
      }
      this.db.ingredients = this.db.ingredients.filter((i) => i !== ing);
      this.db.archived.ingredients.push(ing);
    });
  }

  restore(id: string) {
    return respond(() => {
      const ing = this.db.archived.ingredients.find((i) => i.id === id);
      if (!ing) throw new AppError('ไม่พบวัตถุดิบที่ลบไป');
      if (this.db.ingredients.some((i) => i.name === ing.name)) {
        throw new AppError('กู้คืนไม่ได้ เพราะมีวัตถุดิบชื่อเดียวกันเพิ่มเข้ามาแล้ว');
      }
      this.db.archived.ingredients = this.db.archived.ingredients.filter((i) => i !== ing);
      this.db.ingredients.push(ing);
      return ing;
    });
  }
}

@Injectable()
export class MockProductRepository extends ProductRepository {
  constructor(private db: MockDb) { super(); }

  list() {
    return respond<Product[]>(() =>
      this.db.products.map((p) => ({ ...p, costPerPiece: this.db.productCost(p.recipeId) })),
    );
  }

  remove(id: string) {
    return respond<void>(() => {
      const product = this.db.products.find((p) => p.id === id);
      if (!product) throw new AppError('ไม่พบเมนูนี้ อาจถูกลบไปแล้ว');
      const recipe = this.db.recipes.find((r) => r.productId === id);
      this.db.products = this.db.products.filter((p) => p !== product);
      this.db.archived.products.push(product);
      if (recipe) {
        this.db.recipes = this.db.recipes.filter((r) => r !== recipe);
        this.db.archived.recipes.push(recipe);
      }
    });
  }

  restore(id: string) {
    return respond<void>(() => {
      const product = this.db.archived.products.find((p) => p.id === id);
      if (!product) throw new AppError('ไม่พบเมนูที่ลบไป');
      const recipe = this.db.archived.recipes.find((r) => r.productId === id);
      if (recipe && this.db.recipes.some((r) => r.name === recipe.name)) {
        throw new AppError('กู้คืนไม่ได้ เพราะมีเมนูชื่อเดียวกันเพิ่มเข้ามาแล้ว');
      }
      this.db.archived.products = this.db.archived.products.filter((p) => p !== product);
      this.db.products.push(product);
      if (recipe) {
        this.db.archived.recipes = this.db.archived.recipes.filter((r) => r !== recipe);
        this.db.recipes.push(recipe);
      }
    });
  }
}

@Injectable()
export class MockRecipeRepository extends RecipeRepository {
  constructor(private db: MockDb) { super(); }
  list() { return respond(() => this.db.recipes); }

  get(id: string) {
    return respond(() => this.db.recipe(id));
  }

  create(input: MenuRecipeInput) {
    return respond(() => {
      const clean = this.validate(input, null);
      const recipeId = newId('rcp');
      const productId = newId('prd');
      this.db.products.push({
        id: productId, name: clean.name, category: clean.category, description: '', imageUrl: null,
        recipeId, saleUnit: clean.saleUnit, sellPrice: clean.sellPrice, isActive: true,
      });
      const recipe: Recipe = { ...this.recipeFields(clean), id: recipeId, productId };
      this.db.recipes.push(recipe);
      return recipe;
    });
  }

  update(id: string, input: MenuRecipeInput) {
    return respond(() => {
      const recipe = this.db.recipe(id);
      const clean = this.validate(input, id);
      Object.assign(recipe, this.recipeFields(clean));
      const product = this.db.products.find((p) => p.id === recipe.productId);
      if (product) {
        Object.assign(product, { name: clean.name, category: clean.category, saleUnit: clean.saleUnit, sellPrice: clean.sellPrice });
      }
      return recipe;
    });
  }

  /** Same rules the real API must enforce. */
  private validate(input: MenuRecipeInput, selfId: string | null): MenuRecipeInput {
    const name = input.name.trim();
    if (!name) throw new AppError('กรุณาระบุชื่อเมนู');
    if (this.db.recipes.some((r) => r.name === name && r.id !== selfId)) throw new AppError(`มีเมนูชื่อ "${name}" อยู่แล้ว`);
    if (!input.saleUnit.trim()) throw new AppError('กรุณาระบุหน่วยขาย');
    if (!(input.yieldQty > 0)) throw new AppError('จำนวนที่ผลิตได้ต้องมากกว่า 0');
    if ([input.sellPrice, input.packagingCost, input.laborCost, input.otherCost].some((v) => v < 0)) {
      throw new AppError('ราคาและค่าใช้จ่ายต้องไม่ติดลบ');
    }
    if (input.items.length === 0) throw new AppError('ต้องมีวัตถุดิบอย่างน้อย 1 รายการ');
    const seen = new Set<string>();
    for (const item of input.items) {
      const ing = this.db.ingredient(item.ingredientId);
      if (seen.has(ing.id)) throw new AppError(`ใส่ "${ing.name}" ซ้ำ — รวมเป็นบรรทัดเดียว`);
      seen.add(ing.id);
      if (!(item.quantity > 0)) throw new AppError(`ปริมาณ "${ing.name}" ต้องมากกว่า 0`);
      if (!isCompatible(item.unit, ing.baseUnit)) throw new AppError(`หน่วยของ "${ing.name}" ไม่ถูกต้อง`);
    }
    return { ...input, name, saleUnit: input.saleUnit.trim() };
  }

  private recipeFields(input: MenuRecipeInput) {
    return {
      name: input.name, yieldQty: input.yieldQty, items: input.items.map((i) => ({ ...i })),
      packagingCost: input.packagingCost, laborCost: input.laborCost, otherCost: input.otherCost,
    };
  }
}

@Injectable()
export class MockCostCalculationRepository extends CostCalculationRepository {
  constructor(private db: MockDb) { super(); }

  save(input: CostCalculationInput) {
    return respond(() => {
      const recipe = this.db.recipe(input.recipeId);
      const result = calculateCost({
        ...input,
        lines: recipe.items.map((item) => {
          const ing = this.db.ingredient(item.ingredientId);
          return { ...item, name: ing.name, baseUnit: ing.baseUnit, costPerBaseUnit: ing.avgCostPerBaseUnit };
        }),
      });
      if (!result.complete) throw new AppError(result.problems.join(', '));
      const saved: SavedCostCalculation = {
        ...input, id: newId('calc'), totalCost: result.total!, costPerPiece: result.perPiece!, createdAt: now(),
      };
      this.db.calculations.unshift(saved);
      return saved;
    });
  }
}

@Injectable()
export class MockDashboardRepository extends DashboardRepository {
  constructor(private db: MockDb) { super(); }

  summary() {
    return respond<DashboardSummary>(() => {
      const low = this.db.ingredients.filter((i) => stockLevel(i.quantityOnHand, i.minQuantity) !== 'ok');
      const expiring = this.db.ingredients.filter(
        (i) => i.quantityOnHand > 0 && isExpiringSoon(i.nearestExpiry, EXPIRY_WARNING_DAYS),
      );
      return {
        todaySales: SEED_SALES_TODAY.todaySales,
        todaySalesChangePct: SEED_SALES_TODAY.todaySalesChangePct,
        estimatedGrossProfit: SEED_SALES_TODAY.estimatedGrossProfit,
        orders: SEED_SALES_TODAY.orders,
        lowStock: { count: low.length, names: low.map((i) => i.name) },
        expiringSoon: { count: expiring.length, names: expiring.map((i) => i.name) },
        bestSellers: SEED_SALES_TODAY.bestSellers.map((b) => {
          const p = this.db.products.find((x) => x.id === b.productId)!;
          return { productId: p.id, name: p.name, category: p.category, imageUrl: p.imageUrl, saleUnit: p.saleUnit, sellPrice: p.sellPrice, qtySold: b.qtySold };
        }),
      };
    });
  }
}
