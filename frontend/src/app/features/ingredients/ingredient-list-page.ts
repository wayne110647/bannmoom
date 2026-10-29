import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IngredientRepository } from '../../core/data/repositories';
import { isExpiringSoon, stockLevel } from '../../core/domain/inventory';
import { createLoader } from '../../core/load-state';
import { INGREDIENT_CATEGORIES, Ingredient } from '../../core/models';
import { QtyPipe, UnitCostPipe, UnitPipe } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { EXPIRY_WARNING_DAYS, IngredientBadges } from './ingredient-badges';

type Filter = 'all' | 'low' | 'expiring';

@Component({
  selector: 'app-ingredient-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, PageHeader, Loading, ErrorState, EmptyState, IngredientBadges, QtyPipe, UnitPipe, UnitCostPipe],
  templateUrl: './ingredient-list-page.html',
})
export class IngredientListPage {
  private readonly repo = inject(IngredientRepository);
  private readonly router = inject(Router);

  /** ?filter=low|expiring from dashboard links. */
  filter = input<Filter | undefined>('all');

  protected readonly ingredients = createLoader(() => this.repo.list());
  protected readonly search = signal('');
  protected readonly categoryLabel = Object.fromEntries(INGREDIENT_CATEGORIES.map((c) => [c.value, c.label]));
  protected readonly filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'low', label: 'ใกล้หมด/หมด' },
    { value: 'expiring', label: 'ใกล้หมดอายุ' },
  ];

  protected readonly visible = computed<Ingredient[]>(() => {
    const state = this.ingredients.state();
    if (state.status !== 'ready') return [];
    const term = this.search().trim().toLowerCase();
    const filter = this.filter() ?? 'all';
    return state.data.filter((i) => {
      if (term && !i.name.toLowerCase().includes(term)) return false;
      if (filter === 'low') return stockLevel(i.quantityOnHand, i.minQuantity) !== 'ok';
      if (filter === 'expiring') return i.quantityOnHand > 0 && isExpiringSoon(i.nearestExpiry, EXPIRY_WARNING_DAYS);
      return true;
    });
  });

  protected setFilter(value: Filter) {
    this.router.navigate([], { queryParams: { filter: value === 'all' ? null : value }, replaceUrl: true });
  }
}
