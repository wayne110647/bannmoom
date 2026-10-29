import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProductRepository, RecipeRepository } from '../../core/data/repositories';
import { dec, sub, toNumber } from '../../core/domain/decimal';
import { createLoader } from '../../core/load-state';
import { Product, Recipe } from '../../core/models';
import { BahtPipe } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { ProductThumb } from '../products/product-thumb';

interface RecipeRow {
  recipe: Recipe;
  product: Product | null;
  profit: number | null;
}

@Component({
  selector: 'app-recipe-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, PageHeader, Loading, ErrorState, EmptyState, ProductThumb, BahtPipe],
  templateUrl: './recipe-list-page.html',
})
export class RecipeListPage {
  private readonly recipes = inject(RecipeRepository);
  private readonly products = inject(ProductRepository);
  protected readonly data = createLoader(() => forkJoin({ recipes: this.recipes.list(), products: this.products.list() }));

  protected readonly rows = computed<RecipeRow[]>(() => {
    const s = this.data.state();
    if (s.status !== 'ready') return [];
    return s.data.recipes
      .map((recipe) => {
        const product = s.data.products.find((p) => p.id === recipe.productId) ?? null;
        const profit = product?.costPerPiece == null ? null : toNumber(sub(dec(product.sellPrice), dec(product.costPerPiece)));
        return { recipe, product, profit };
      })
      .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name, 'th'));
  });
}
