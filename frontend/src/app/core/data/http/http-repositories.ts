import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import {
  AdjustmentInput, CostCalculationInput, DashboardSummary, Ingredient, IngredientInput, NewIngredientInput,
  MenuRecipeInput, Product, Recipe, SavedCostCalculation, StockInInput, StockTransaction, UsageInput,
} from '../../models';
import {
  CostCalculationRepository, DashboardRepository, IngredientRepository, ProductRepository, RecipeRepository,
} from '../repositories';

/** Real API implementations (Cloudflare Workers → Neon). Used when environment.dataSource === 'api'. */

const api = (path: string) => `${environment.apiBaseUrl}${path}`;

@Injectable()
export class HttpIngredientRepository extends IngredientRepository {
  private http = inject(HttpClient);

  list() { return this.http.get<Ingredient[]>(api('/ingredients')); }
  get(id: string) { return this.http.get<Ingredient>(api(`/ingredients/${id}`)); }
  create(input: NewIngredientInput) { return this.http.post<Ingredient>(api('/ingredients'), input); }
  update(id: string, input: IngredientInput) { return this.http.put<Ingredient>(api(`/ingredients/${id}`), input); }
  transactions(id: string) { return this.http.get<StockTransaction[]>(api(`/ingredients/${id}/transactions`)); }
  stockIn(id: string, input: StockInInput) { return this.http.post<Ingredient>(api(`/ingredients/${id}/stock-in`), input); }
  usage(id: string, input: UsageInput) { return this.http.post<Ingredient>(api(`/ingredients/${id}/usages`), input); }
  adjust(id: string, input: AdjustmentInput) { return this.http.post<Ingredient>(api(`/ingredients/${id}/adjustments`), input); }
}

@Injectable()
export class HttpProductRepository extends ProductRepository {
  private http = inject(HttpClient);
  list() { return this.http.get<Product[]>(api('/products')); }
}

@Injectable()
export class HttpRecipeRepository extends RecipeRepository {
  private http = inject(HttpClient);
  list() { return this.http.get<Recipe[]>(api('/recipes')); }
  get(id: string) { return this.http.get<Recipe>(api(`/recipes/${id}`)); }
  create(input: MenuRecipeInput) { return this.http.post<Recipe>(api('/recipes'), input); }
  update(id: string, input: MenuRecipeInput) { return this.http.put<Recipe>(api(`/recipes/${id}`), input); }
}

@Injectable()
export class HttpCostCalculationRepository extends CostCalculationRepository {
  private http = inject(HttpClient);
  save(input: CostCalculationInput) { return this.http.post<SavedCostCalculation>(api('/cost-calculations'), input); }
}

@Injectable()
export class HttpDashboardRepository extends DashboardRepository {
  private http = inject(HttpClient);
  summary() { return this.http.get<DashboardSummary>(api('/reports/summary')); }
}
