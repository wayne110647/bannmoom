import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { IngredientRepository } from '../../core/data/repositories';
import { createLoader } from '../../core/load-state';
import { INGREDIENT_CATEGORIES, STOCK_TX_LABEL, StockTxType } from '../../core/models';
import { QtyPipe, ThaiDatePipe, UnitCostPipe, UnitPipe } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { IngredientBadges } from './ingredient-badges';

@Component({
  selector: 'app-ingredient-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, PageHeader, Loading, ErrorState, EmptyState, IngredientBadges, QtyPipe, UnitPipe, UnitCostPipe, ThaiDatePipe],
  templateUrl: './ingredient-detail-page.html',
})
export class IngredientDetailPage {
  private readonly repo = inject(IngredientRepository);
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;

  protected readonly detail = createLoader(() =>
    forkJoin({ ingredient: this.repo.get(this.id), history: this.repo.transactions(this.id) }),
  );

  protected readonly categoryLabel = Object.fromEntries(INGREDIENT_CATEGORIES.map((c) => [c.value, c.label]));
  protected readonly txLabel = STOCK_TX_LABEL;
  protected readonly txIcon: Record<StockTxType, 'stock-in' | 'stock-out' | 'sliders'> = {
    opening: 'stock-in', stock_in: 'stock-in', sale_reversal: 'stock-in',
    usage: 'stock-out', sale: 'stock-out', adjustment: 'sliders',
  };
}
