import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProductRepository, RecipeRepository } from '../../core/data/repositories';
import { dec, sub, toNumber } from '../../core/domain/decimal';
import { createLoader } from '../../core/load-state';
import { Product, Recipe } from '../../core/models';
import { ActionSheetService, SheetAnchor, anchorBelow } from '../../shared/action-sheet';
import { injectConfirmDelete } from '../../shared/confirm-delete';
import { BahtPipe } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { LongPress } from '../../shared/long-press';
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
  imports: [RouterLink, Icon, PageHeader, Loading, ErrorState, EmptyState, ProductThumb, LongPress, BahtPipe],
  templateUrl: './recipe-list-page.html',
})
export class RecipeListPage {
  private readonly recipes = inject(RecipeRepository);
  private readonly products = inject(ProductRepository);
  private readonly router = inject(Router);
  private readonly sheet = inject(ActionSheetService);
  private readonly confirmDelete = injectConfirmDelete();
  protected readonly anchorBelow = anchorBelow;
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

  protected openMenu(row: RecipeRow, anchor: SheetAnchor | null) {
    const { recipe } = row;
    this.sheet.open(
      recipe.name,
      [
        { label: 'ดูต้นทุน', icon: 'calculator', run: () => this.router.navigate(['/cost'], { queryParams: { recipe: recipe.id } }) },
        { label: 'แก้ไขเมนู', icon: 'pencil', run: () => this.router.navigate(['/recipes', recipe.id, 'edit']) },
        ...(recipe.productId
          ? [{ label: 'ลบเมนู', icon: 'trash' as const, danger: true, run: () => this.remove(recipe.productId!, recipe.name) }]
          : []),
      ],
      { anchor },
    );
  }

  private remove(productId: string, name: string) {
    this.confirmDelete({
      name,
      detail: 'สูตรของเมนูนี้จะถูกลบด้วย — กด "เลิกทำ" ได้ทันทีถ้ากดผิด',
      remove: () => this.products.remove(productId),
      restore: () => this.products.restore(productId),
      onRemoved: () =>
        this.data.update((d) => ({ ...d, recipes: d.recipes.filter((r) => r.productId !== productId) })),
      onRestored: () => this.data.reload(),
    });
  }
}
