import { z } from 'zod';
import { UNIT_CODES, UnitCode } from '../../frontend/src/app/core/domain/units';
import { INGREDIENT_CATEGORIES, IngredientCategory, PRODUCT_CATEGORIES, ProductCategory } from '../../frontend/src/app/core/models';

/** Request bodies are checked here; business rules (stock can't go negative, units must match…) live in the services. */

const LIMIT = 1_000_000_000;

const unit = z.enum(UNIT_CODES as [UnitCode, ...UnitCode[]]);
const money = z.number().finite().min(0).max(LIMIT);
const positive = z.number().finite().gt(0).max(LIMIT);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const note = z.string().trim().max(200).nullable().transform((v) => v || null);
const name = z.string().trim().min(1).max(80);

export const stockInSchema = z.object({
  packSize: positive,
  packUnit: unit,
  packCount: positive,
  pricePerPack: money,
  expiryDate: isoDate,
  note,
});

export const ingredientSchema = z.object({
  name,
  category: z.enum(INGREDIENT_CATEGORIES.map((c) => c.value) as [IngredientCategory, ...IngredientCategory[]]),
  displayUnit: unit,
  minQuantity: money,
});

export const newIngredientSchema = ingredientSchema.extend({ opening: stockInSchema.nullable() });

export const usageSchema = z.object({ quantity: positive, unit, note });

export const adjustmentSchema = z.object({
  countedQuantity: money,
  unit,
  reason: z.string().trim().min(1).max(50),
  note,
});

export const menuRecipeSchema = z.object({
  name,
  category: z.enum(PRODUCT_CATEGORIES.map((c) => c.value) as [ProductCategory, ...ProductCategory[]]),
  saleUnit: z.string().trim().min(1).max(20),
  sellPrice: money,
  yieldQty: positive,
  packagingCost: money,
  laborCost: money,
  otherCost: money,
  items: z
    .array(z.object({ ingredientId: z.string().min(1).max(64), quantity: positive, unit }))
    .min(1)
    .max(50),
});

export const costCalculationSchema = z.object({
  recipeId: z.string().min(1).max(64),
  packagingCost: money,
  laborCost: money,
  otherCost: money,
  yieldQty: positive,
  sellPrice: money.nullable(),
});
