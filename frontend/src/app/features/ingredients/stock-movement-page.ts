import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, finalize, startWith } from 'rxjs';
import { IngredientRepository } from '../../core/data/repositories';
import { dec, sub, toNumber } from '../../core/domain/decimal';
import { UnitCode, compatibleUnits, convert, unitLabel } from '../../core/domain/units';
import { toUserMessage } from '../../core/errors';
import { createLoader } from '../../core/load-state';
import { ADJUSTMENT_REASONS, Ingredient } from '../../core/models';
import { QtyPipe } from '../../shared/format';
import { Icon, IconName } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { ErrorState, Loading } from '../../shared/states';
import { ToastService } from '../../shared/toast';
import { StockInFields, createStockInForm, readStockInForm } from './stock-in-fields';

type MoveType = 'in' | 'use' | 'adjust';

const META: Record<MoveType, { title: string; icon: IconName; done: string }> = {
  in: { title: 'รับวัตถุดิบเข้า', icon: 'stock-in', done: 'บันทึกรับเข้าแล้ว' },
  use: { title: 'เบิกใช้วัตถุดิบ', icon: 'stock-out', done: 'บันทึกการเบิกใช้แล้ว' },
  adjust: { title: 'ปรับยอดคงเหลือ', icon: 'sliders', done: 'ปรับยอดแล้ว' },
};

@Component({
  selector: 'app-stock-movement-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, PageHeader, Loading, ErrorState, StockInFields, QtyPipe],
  templateUrl: './stock-movement-page.html',
})
export class StockMovementPage {
  private readonly repo = inject(IngredientRepository);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly params = inject(ActivatedRoute).snapshot.paramMap;

  protected readonly id = this.params.get('id')!;
  protected readonly type = (['in', 'use', 'adjust'].includes(this.params.get('type')!) ? this.params.get('type') : 'in') as MoveType;
  protected readonly meta = META[this.type];
  protected readonly reasons = ADJUSTMENT_REASONS;
  protected readonly unitLabel = unitLabel;
  protected readonly saving = signal(false);

  protected readonly ingredient = createLoader(() => this.repo.get(this.id));

  protected readonly stockInForm = createStockInForm('g');
  protected readonly qtyForm = new FormGroup({
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    unit: new FormControl<UnitCode>('g', { nonNullable: true }),
    reason: new FormControl<string>(this.type === 'adjust' ? ADJUSTMENT_REASONS[0] : '', { nonNullable: true }),
    note: new FormControl<string | null>(null, [Validators.maxLength(200)]),
  });
  private readonly qtyValue = toSignal(this.qtyForm.valueChanges.pipe(startWith(this.qtyForm.value)));

  constructor() {
    // Default units to the ingredient's preferred unit once it has loaded.
    effect(() => {
      const s = this.ingredient.state();
      if (s.status !== 'ready') return;
      untracked(() => {
        this.qtyForm.controls.unit.setValue(s.data.displayUnit);
        this.stockInForm.controls.packUnit.setValue(s.data.displayUnit);
      });
    });
  }

  protected unitsFor(ing: Ingredient) {
    return compatibleUnits(ing.baseUnit);
  }

  /** Preview of the resulting balance for "use" and "adjust" (base unit), or an error text. */
  protected readonly preview = computed<{ after: number; delta: number } | { error: string } | null>(() => {
    const s = this.ingredient.state();
    const v = this.qtyValue();
    if (s.status !== 'ready' || this.type === 'in' || v?.quantity === null || v?.quantity === undefined || !v.unit) return null;
    const ing = s.data;
    const qty = convert(dec(v.quantity), v.unit, ing.baseUnit);
    if (this.type === 'use') {
      const after = toNumber(sub(dec(ing.quantityOnHand), qty));
      if (v.quantity <= 0) return { error: 'จำนวนต้องมากกว่า 0' };
      if (after < 0) return { error: 'เบิกเกินกว่าที่มีอยู่ในสต็อก' };
      return { after, delta: -toNumber(qty) };
    }
    const delta = toNumber(sub(qty, dec(ing.quantityOnHand)));
    if (delta === 0) return { error: 'ยอดที่นับได้เท่ากับยอดในระบบแล้ว' };
    return { after: toNumber(qty), delta };
  });

  protected submit(ing: Ingredient) {
    if (this.saving()) return;
    let request: Observable<Ingredient>;

    if (this.type === 'in') {
      this.stockInForm.markAllAsTouched();
      if (this.stockInForm.invalid) return this.toast.error('กรุณากรอกขนาด จำนวน และราคาให้ครบ');
      request = this.repo.stockIn(ing.id, readStockInForm(this.stockInForm));
    } else {
      this.qtyForm.markAllAsTouched();
      const p = this.preview();
      if (this.qtyForm.invalid || !p) return this.toast.error('กรุณาระบุจำนวน');
      if ('error' in p) return this.toast.error(p.error);
      const v = this.qtyForm.getRawValue();
      const note = v.note?.trim() || null;
      if (this.type === 'use') {
        request = this.repo.usage(ing.id, { quantity: v.quantity!, unit: v.unit, note });
      } else {
        if (!v.reason) return this.toast.error('กรุณาเลือกเหตุผลการปรับยอด');
        request = this.repo.adjust(ing.id, { countedQuantity: v.quantity!, unit: v.unit, reason: v.reason, note });
      }
    }

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.toast.success(this.meta.done);
        this.router.navigate(['/stock', ing.id], { replaceUrl: true });
      },
      error: (e) => this.toast.error(toUserMessage(e)),
    });
  }
}
