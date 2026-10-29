import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, map, of, startWith } from 'rxjs';
import { IngredientRepository, ProductRepository, RecipeRepository } from '../../core/data/repositories';
import { CostResult, calculateCost } from '../../core/domain/cost';
import { UnitCode, compatibleUnits, unitLabel } from '../../core/domain/units';
import { toUserMessage } from '../../core/errors';
import { Ingredient, MenuRecipeInput, PRODUCT_CATEGORIES, ProductCategory, RecipeItem } from '../../core/models';
import { injectConfirmDelete } from '../../shared/confirm-delete';
import { BahtPipe } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { ErrorState, Loading } from '../../shared/states';
import { ToastService } from '../../shared/toast';

type ItemForm = FormGroup<{
  ingredientId: FormControl<string>;
  quantity: FormControl<number | null>;
  unit: FormControl<UnitCode>;
}>;

const SALE_UNITS = ['ชิ้น', 'กล่อง', 'ถ้วย', 'ปอนด์', 'แพ็ก'];

@Component({
  selector: 'app-recipe-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, PageHeader, Loading, ErrorState, BahtPipe],
  templateUrl: './recipe-form-page.html',
})
export class RecipeFormPage {
  private readonly recipes = inject(RecipeRepository);
  private readonly products = inject(ProductRepository);
  private readonly ingredientRepo = inject(IngredientRepository);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly isEdit = this.id !== null;
  protected readonly categories = PRODUCT_CATEGORIES;
  protected readonly saleUnits = SALE_UNITS;
  protected readonly unitLabel = unitLabel;

  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly loadError = signal('');
  protected readonly saving = signal(false);
  protected readonly ingredients = signal<Ingredient[]>([]);
  /** The menu item this recipe belongs to (edit mode); deleting removes both. */
  protected readonly productId = signal<string | null>(null);
  private readonly confirmDelete = injectConfirmDelete();

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    category: new FormControl<ProductCategory>('cake', { nonNullable: true }),
    saleUnit: new FormControl('ชิ้น', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    sellPrice: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    yieldQty: new FormControl<number | null>(1, [Validators.required, Validators.min(0.000001)]),
    packagingCost: new FormControl<number | null>(0, [Validators.min(0)]),
    laborCost: new FormControl<number | null>(0, [Validators.min(0)]),
    otherCost: new FormControl<number | null>(0, [Validators.min(0)]),
    items: new FormArray<ItemForm>([]),
  });

  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())), {
    requireSync: true,
  });

  protected readonly saleUnit = computed(() => this.value().saleUnit.trim() || 'ชิ้น');

  /** Live cost preview — same formula the calculator uses. Lines without an ingredient yet are skipped. */
  protected readonly preview = computed<CostResult | null>(() => {
    const v = this.value();
    const byId = new Map(this.ingredients().map((i) => [i.id, i]));
    const lines = v.items
      .filter((it) => it.ingredientId && (it.quantity ?? 0) > 0)
      .map((it) => {
        const ing = byId.get(it.ingredientId)!;
        return {
          ingredientId: ing.id, name: ing.name, quantity: it.quantity!, unit: it.unit,
          baseUnit: ing.baseUnit, costPerBaseUnit: ing.avgCostPerBaseUnit,
        };
      });
    if (lines.length === 0) return null;
    return calculateCost({
      lines,
      packagingCost: v.packagingCost ?? 0,
      laborCost: v.laborCost ?? 0,
      otherCost: v.otherCost ?? 0,
      yieldQty: v.yieldQty ?? 0,
      sellPrice: v.sellPrice,
    });
  });

  protected readonly lineCost = computed(() => new Map(this.preview()?.lines.map((l) => [l.ingredientId, l]) ?? []));

  constructor() {
    this.load();
  }

  protected get items() {
    return this.form.controls.items;
  }

  protected load() {
    this.loadState.set('loading');
    forkJoin({
      ingredients: this.ingredientRepo.list(),
      recipe: this.isEdit ? this.recipes.get(this.id!) : of(null),
      products: this.isEdit ? this.products.list() : of([]),
    }).subscribe({
      next: ({ ingredients, recipe, products }) => {
        this.ingredients.set(ingredients);
        this.items.clear();
        if (recipe) {
          const product = products.find((p) => p.id === recipe.productId);
          this.productId.set(recipe.productId);
          this.form.patchValue({
            name: recipe.name,
            category: product?.category ?? 'other',
            saleUnit: product?.saleUnit ?? 'ชิ้น',
            sellPrice: product?.sellPrice ?? null,
            yieldQty: recipe.yieldQty,
            packagingCost: recipe.packagingCost,
            laborCost: recipe.laborCost,
            otherCost: recipe.otherCost,
          });
          recipe.items.forEach((item) => this.items.push(this.itemForm(item)));
        } else {
          this.addItem();
        }
        this.loadState.set('ready');
      },
      error: (e) => {
        this.loadError.set(toUserMessage(e));
        this.loadState.set('error');
      },
    });
  }

  private itemForm(item?: RecipeItem): ItemForm {
    const group: ItemForm = new FormGroup({
      ingredientId: new FormControl(item?.ingredientId ?? '', { nonNullable: true, validators: Validators.required }),
      quantity: new FormControl<number | null>(item?.quantity ?? null, [Validators.required, Validators.min(0.000001)]),
      unit: new FormControl<UnitCode>(item?.unit ?? 'g', { nonNullable: true }),
    });
    // Picking an ingredient switches to the unit it is normally counted in.
    group.controls.ingredientId.valueChanges.subscribe((id) => {
      const ing = this.ingredients().find((i) => i.id === id);
      if (ing) group.controls.unit.setValue(ing.displayUnit);
    });
    return group;
  }

  protected addItem() {
    this.items.push(this.itemForm());
  }

  protected removeItem(index: number) {
    this.items.removeAt(index);
  }

  /** Units this line may use — only the same dimension as its ingredient (g ↔ kg, never g ↔ ฟอง). */
  protected unitsFor(ingredientId: string): UnitCode[] {
    const ing = this.ingredients().find((i) => i.id === ingredientId);
    return ing ? compatibleUnits(ing.baseUnit) : [];
  }

  /** Ingredients not yet used on another line, plus this line's own choice. */
  protected ingredientOptions(index: number): Ingredient[] {
    const used = new Set(this.value().items.filter((_, i) => i !== index).map((it) => it.ingredientId));
    return this.ingredients().filter((i) => !used.has(i.id));
  }

  protected remove() {
    const productId = this.productId();
    if (!productId) return;
    const name = this.form.controls.name.value;
    this.confirmDelete({
      name,
      detail: 'สูตรของเมนูนี้จะถูกลบด้วย — กด "เลิกทำ" ได้ทันทีถ้ากดผิด',
      remove: () => this.products.remove(productId),
      restore: () => this.products.restore(productId),
      onRemoved: () => this.router.navigate(['/recipes'], { replaceUrl: true }),
      onRestored: () => this.router.navigate(['/recipes', this.id, 'edit']),
    });
  }

  protected submit() {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    if (this.items.length === 0) {
      this.toast.error('ต้องมีวัตถุดิบอย่างน้อย 1 รายการ');
      return;
    }
    if (this.form.invalid) {
      this.toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบ');
      return;
    }

    const v = this.form.getRawValue();
    const input: MenuRecipeInput = {
      name: v.name.trim(),
      category: v.category,
      saleUnit: v.saleUnit.trim(),
      sellPrice: v.sellPrice ?? 0,
      yieldQty: v.yieldQty ?? 0,
      packagingCost: v.packagingCost ?? 0,
      laborCost: v.laborCost ?? 0,
      otherCost: v.otherCost ?? 0,
      items: v.items.map((it) => ({ ingredientId: it.ingredientId, quantity: it.quantity!, unit: it.unit })),
    };
    const request = this.isEdit ? this.recipes.update(this.id!, input) : this.recipes.create(input);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => {
        this.toast.success(this.isEdit ? 'บันทึกการแก้ไขแล้ว' : `เพิ่มเมนู "${saved.name}" แล้ว`);
        this.router.navigate(['/recipes'], { replaceUrl: true });
      },
      error: (e) => this.toast.error(toUserMessage(e)),
    });
  }
}
