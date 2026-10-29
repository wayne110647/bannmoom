import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { CostCalculationRepository, IngredientRepository, ProductRepository, RecipeRepository } from '../../core/data/repositories';
import { CostResult, calculateCost, priceForMargin } from '../../core/domain/cost';
import { toUserMessage } from '../../core/errors';
import { createLoader } from '../../core/load-state';
import { Recipe } from '../../core/models';
import { BahtPipe, UnitPipe } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { ToastService } from '../../shared/toast';

@Component({
  selector: 'app-cost-calculator-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, PageHeader, Loading, ErrorState, EmptyState, BahtPipe, UnitPipe],
  templateUrl: './cost-calculator-page.html',
})
export class CostCalculatorPage {
  private readonly recipes = inject(RecipeRepository);
  private readonly ingredients = inject(IngredientRepository);
  private readonly products = inject(ProductRepository);
  private readonly calculations = inject(CostCalculationRepository);
  private readonly toast = inject(ToastService);
  private readonly requestedRecipe = inject(ActivatedRoute).snapshot.queryParamMap.get('recipe');

  protected readonly data = createLoader(() =>
    forkJoin({ recipes: this.recipes.list(), ingredients: this.ingredients.list(), products: this.products.list() }),
  );

  // Inputs the owner can play with
  protected readonly recipeId = signal<string | null>(null);
  protected readonly packagingCost = signal<number | null>(0);
  protected readonly laborCost = signal<number | null>(0);
  protected readonly otherCost = signal<number | null>(0);
  protected readonly yieldQty = signal<number | null>(1);
  protected readonly sellPrice = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly marginPresets = [30, 40, 50, 60];

  protected readonly recipe = computed<Recipe | null>(() => {
    const s = this.data.state();
    return s.status === 'ready' ? (s.data.recipes.find((r) => r.id === this.recipeId()) ?? null) : null;
  });

  protected readonly saleUnit = computed(() => {
    const s = this.data.state();
    const r = this.recipe();
    if (s.status !== 'ready' || !r) return 'ชิ้น';
    return s.data.products.find((p) => p.id === r.productId)?.saleUnit ?? 'ชิ้น';
  });

  protected readonly result = computed<CostResult | null>(() => {
    const s = this.data.state();
    const r = this.recipe();
    if (s.status !== 'ready' || !r) return null;
    const byId = new Map(s.data.ingredients.map((i) => [i.id, i]));
    return calculateCost({
      lines: r.items.map((item) => {
        const ing = byId.get(item.ingredientId);
        return {
          ...item,
          name: ing?.name ?? 'วัตถุดิบที่ถูกลบ',
          baseUnit: ing?.baseUnit ?? item.unit,
          costPerBaseUnit: ing?.avgCostPerBaseUnit ?? null,
        };
      }),
      packagingCost: this.packagingCost() ?? 0,
      laborCost: this.laborCost() ?? 0,
      otherCost: this.otherCost() ?? 0,
      yieldQty: this.yieldQty() ?? 0,
      sellPrice: this.sellPrice(),
    });
  });

  constructor() {
    // Pick the recipe from ?recipe= (or the first one) once data arrives.
    effect(() => {
      const s = this.data.state();
      if (s.status !== 'ready' || untracked(this.recipeId) !== null || s.data.recipes.length === 0) return;
      const wanted = s.data.recipes.find((r) => r.id === this.requestedRecipe) ?? s.data.recipes[0];
      untracked(() => this.selectRecipe(wanted.id));
    });
  }

  protected selectRecipe(id: string) {
    const s = this.data.state();
    if (s.status !== 'ready') return;
    const r = s.data.recipes.find((x) => x.id === id);
    if (!r) return;
    this.recipeId.set(r.id);
    this.packagingCost.set(r.packagingCost);
    this.laborCost.set(r.laborCost);
    this.otherCost.set(r.otherCost);
    this.yieldQty.set(r.yieldQty);
    this.sellPrice.set(s.data.products.find((p) => p.id === r.productId)?.sellPrice ?? null);
  }

  /** Round the suggested price up to a whole baht — friendlier for a shop price tag. */
  protected applyMargin(pct: number) {
    const perPiece = this.result()?.perPiece;
    if (perPiece == null) return;
    this.sellPrice.set(Math.ceil(priceForMargin(perPiece, pct)));
  }

  protected save() {
    const r = this.recipe();
    const res = this.result();
    if (this.saving() || !r || !res?.complete) return;
    this.saving.set(true);
    this.calculations
      .save({
        recipeId: r.id,
        packagingCost: this.packagingCost() ?? 0,
        laborCost: this.laborCost() ?? 0,
        otherCost: this.otherCost() ?? 0,
        yieldQty: this.yieldQty() ?? 0,
        sellPrice: this.sellPrice(),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.toast.success('บันทึกผลการคำนวณแล้ว'),
        error: (e) => this.toast.error(toUserMessage(e)),
      });
  }
}
