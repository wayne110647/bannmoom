import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { STOCK_LEVEL_LABEL, daysUntil, isExpiringSoon, stockLevel } from '../../core/domain/inventory';
import { Ingredient } from '../../core/models';

export const EXPIRY_WARNING_DAYS = 7;

/** Stock level + expiry badges, shared by list, table and detail views. */
@Component({
  selector: 'app-ingredient-badges',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex flex-wrap gap-1' },
  template: `
    @switch (level()) {
      @case ('out') { <span class="badge-danger">{{ labels.out }}</span> }
      @case ('low') { <span class="badge-warning">{{ labels.low }}</span> }
      @default { <span class="badge-success">{{ labels.ok }}</span> }
    }
    @if (expiryText(); as text) {
      <span class="badge-danger">{{ text }}</span>
    }
  `,
})
export class IngredientBadges {
  ingredient = input.required<Ingredient>();
  protected labels = STOCK_LEVEL_LABEL;
  protected level = computed(() => stockLevel(this.ingredient().quantityOnHand, this.ingredient().minQuantity));
  protected expiryText = computed(() => {
    const ing = this.ingredient();
    if (ing.quantityOnHand <= 0 || !isExpiringSoon(ing.nearestExpiry, EXPIRY_WARNING_DAYS)) return null;
    const days = daysUntil(ing.nearestExpiry!);
    if (days < 0) return 'หมดอายุแล้ว';
    if (days === 0) return 'หมดอายุวันนี้';
    return `หมดอายุใน ${days} วัน`;
  });
}
