import { Observable } from 'rxjs';
import {
  AdjustmentInput, CostCalculationInput, DashboardSummary, Expense, ExpenseInput, Ingredient, IngredientInput, Ledger,
  MenuRecipeInput, NewIngredientInput, Product, Recipe, Sale, SaleInput, SaleResult, SavedCostCalculation, StockInInput,
  StockTransaction, UsageInput,
} from '../models';

/**
 * Data-access contracts. Components depend only on these abstract classes.
 * app.config.ts decides whether the Mock* (sample data) or Http* (real API)
 * implementation is provided — see environment.dataSource.
 */

export abstract class IngredientRepository {
  abstract list(): Observable<Ingredient[]>;
  abstract get(id: string): Observable<Ingredient>;
  abstract create(input: NewIngredientInput): Observable<Ingredient>;
  abstract update(id: string, input: IngredientInput): Observable<Ingredient>;
  abstract transactions(id: string): Observable<StockTransaction[]>;
  abstract stockIn(id: string, input: StockInInput): Observable<Ingredient>;
  abstract usage(id: string, input: UsageInput): Observable<Ingredient>;
  abstract adjust(id: string, input: AdjustmentInput): Observable<Ingredient>;
  /** Archives it (history kept). Fails with a clear message while a menu still uses it. */
  abstract remove(id: string): Observable<void>;
  /** Undo for remove(). */
  abstract restore(id: string): Observable<Ingredient>;
}

export abstract class ProductRepository {
  abstract list(): Observable<Product[]>;
  /** Deletes the menu item together with its recipe (archived, so restore() can undo it). */
  abstract remove(id: string): Observable<void>;
  abstract restore(id: string): Observable<void>;
}

export abstract class RecipeRepository {
  abstract list(): Observable<Recipe[]>;
  abstract get(id: string): Observable<Recipe>;
  /** Creates the recipe and its menu item (product) together. */
  abstract create(input: MenuRecipeInput): Observable<Recipe>;
  abstract update(id: string, input: MenuRecipeInput): Observable<Recipe>;
}

export abstract class CostCalculationRepository {
  abstract save(input: CostCalculationInput): Observable<SavedCostCalculation>;
}

/** Sales, other expenses and the income/expense ledger (รายรับ-รายจ่าย). Dates are 'YYYY-MM-DD'. */
export abstract class SalesRepository {
  abstract list(from: string, to: string): Observable<Sale[]>;
  /** Saves even when stock runs short; the shortages come back for the owner to fix. */
  abstract create(input: SaleInput): Observable<SaleResult>;
  /** Cancels a sale and gives its stock back. */
  abstract cancel(id: string): Observable<void>;
  abstract createExpense(input: ExpenseInput): Observable<Expense>;
  abstract removeExpense(id: string): Observable<void>;
  abstract restoreExpense(id: string): Observable<void>;
  abstract ledger(from: string, to: string): Observable<Ledger>;
}

export abstract class DashboardRepository {
  abstract summary(): Observable<DashboardSummary>;
}
