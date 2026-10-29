import { Provider } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  HttpCostCalculationRepository, HttpDashboardRepository, HttpIngredientRepository, HttpProductRepository,
  HttpRecipeRepository,
} from './http/http-repositories';
import {
  MockCostCalculationRepository, MockDashboardRepository, MockIngredientRepository, MockProductRepository,
  MockRecipeRepository,
} from './mock/mock-repositories';
import {
  CostCalculationRepository, DashboardRepository, IngredientRepository, ProductRepository, RecipeRepository,
} from './repositories';

export const usingMockData = environment.dataSource === 'mock';

/** The single place that decides mock vs. real API. */
export function provideDataLayer(): Provider[] {
  return usingMockData
    ? [
        { provide: IngredientRepository, useClass: MockIngredientRepository },
        { provide: ProductRepository, useClass: MockProductRepository },
        { provide: RecipeRepository, useClass: MockRecipeRepository },
        { provide: CostCalculationRepository, useClass: MockCostCalculationRepository },
        { provide: DashboardRepository, useClass: MockDashboardRepository },
      ]
    : [
        { provide: IngredientRepository, useClass: HttpIngredientRepository },
        { provide: ProductRepository, useClass: HttpProductRepository },
        { provide: RecipeRepository, useClass: HttpRecipeRepository },
        { provide: CostCalculationRepository, useClass: HttpCostCalculationRepository },
        { provide: DashboardRepository, useClass: HttpDashboardRepository },
      ];
}
