import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, startWith } from 'rxjs';
import { IngredientRepository } from '../../core/data/repositories';
import { dec, toNumber } from '../../core/domain/decimal';
import { UNIT_CODES, UnitCode, baseUnitOf, compatibleUnits, convert, unitLabel } from '../../core/domain/units';
import { toUserMessage } from '../../core/errors';
import { INGREDIENT_CATEGORIES, Ingredient, IngredientCategory, IngredientInput } from '../../core/models';
import { injectConfirmDelete } from '../../shared/confirm-delete';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { ErrorState, Loading } from '../../shared/states';
import { ToastService } from '../../shared/toast';
import { StockInFields, createStockInForm, readStockInForm } from './stock-in-fields';

@Component({
  selector: 'app-ingredient-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, PageHeader, Loading, ErrorState, StockInFields],
  templateUrl: './ingredient-form-page.html',
})
export class IngredientFormPage {
  private readonly repo = inject(IngredientRepository);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirmDelete = injectConfirmDelete();

  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly isEdit = this.id !== null;
  protected readonly categories = INGREDIENT_CATEGORIES;
  protected readonly unitLabel = unitLabel;

  protected readonly loadState = signal<'loading' | 'ready' | 'error'>(this.isEdit ? 'loading' : 'ready');
  protected readonly loadError = signal('');
  protected readonly saving = signal(false);
  protected readonly existing = signal<Ingredient | null>(null);
  protected readonly unitOptions = signal<UnitCode[]>(UNIT_CODES);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    category: new FormControl<IngredientCategory>('flour', { nonNullable: true }),
    displayUnit: new FormControl<UnitCode>('kg', { nonNullable: true }),
    minQuantity: new FormControl<number | null>(0, [Validators.required, Validators.min(0)]),
    hasOpening: new FormControl(false, { nonNullable: true }),
  });
  protected readonly opening = createStockInForm('kg');

  protected readonly displayUnit = toSignal(
    this.form.controls.displayUnit.valueChanges.pipe(startWith(this.form.controls.displayUnit.value)),
    { requireSync: true },
  );
  protected readonly hasOpening = toSignal(
    this.form.controls.hasOpening.valueChanges.pipe(startWith(false)),
    { requireSync: true },
  );

  constructor() {
    // Keep the opening-stock unit in the same dimension as the chosen unit.
    this.form.controls.displayUnit.valueChanges.subscribe((unit) => this.opening.controls.packUnit.setValue(unit));
    if (this.isEdit) this.load();
  }

  protected baseUnit = () => baseUnitOf(this.displayUnit());

  protected load() {
    this.loadState.set('loading');
    this.repo.get(this.id!).subscribe({
      next: (ing) => {
        this.existing.set(ing);
        // Only same-dimension units are allowed once stock exists (kg ↔ g, never g → ฟอง).
        this.unitOptions.set(compatibleUnits(ing.baseUnit));
        this.form.patchValue({
          name: ing.name,
          category: ing.category,
          displayUnit: ing.displayUnit,
          minQuantity: toNumber(convert(dec(ing.minQuantity), ing.baseUnit, ing.displayUnit)),
        });
        this.loadState.set('ready');
      },
      error: (e) => {
        this.loadError.set(toUserMessage(e));
        this.loadState.set('error');
      },
    });
  }

  protected submit() {
    if (this.saving()) return;
    const withOpening = !this.isEdit && this.hasOpening();
    this.form.markAllAsTouched();
    this.opening.markAllAsTouched();
    if (this.form.invalid || (withOpening && this.opening.invalid)) {
      this.toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบ');
      return;
    }

    const v = this.form.getRawValue();
    const input: IngredientInput = {
      name: v.name.trim(), category: v.category, displayUnit: v.displayUnit, minQuantity: v.minQuantity ?? 0,
    };
    const request = this.isEdit
      ? this.repo.update(this.id!, input)
      : this.repo.create({ ...input, opening: withOpening ? readStockInForm(this.opening) : null });

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => {
        this.toast.success(this.isEdit ? 'บันทึกการแก้ไขแล้ว' : `เพิ่ม "${saved.name}" แล้ว`);
        this.router.navigate(['/stock', saved.id], { replaceUrl: true });
      },
      error: (e) => this.toast.error(toUserMessage(e)),
    });
  }

  protected remove() {
    const ing = this.existing();
    if (!ing) return;
    this.confirmDelete({
      name: ing.name,
      remove: () => this.repo.remove(ing.id),
      restore: () => this.repo.restore(ing.id),
      onRemoved: () => this.router.navigate(['/stock'], { replaceUrl: true }),
      onRestored: () => this.router.navigate(['/stock', ing.id]),
    });
  }

  protected cancelLink() {
    return this.isEdit ? ['/stock', this.id] : ['/stock'];
  }
}
