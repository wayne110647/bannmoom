import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { dec, mul, toNumber } from '../../core/domain/decimal';
import { costPerBaseUnit } from '../../core/domain/inventory';
import { UnitCode, compatibleUnits, toBase, unitLabel } from '../../core/domain/units';
import { StockInInput } from '../../core/models';
import { BahtPipe, QtyPipe, UnitCostPipe } from '../../shared/format';

export type StockInForm = FormGroup<{
  packSize: FormControl<number | null>;
  packUnit: FormControl<UnitCode>;
  packCount: FormControl<number | null>;
  pricePerPack: FormControl<number | null>;
  expiryDate: FormControl<string | null>;
  note: FormControl<string | null>;
}>;

export function createStockInForm(unit: UnitCode): StockInForm {
  return new FormGroup({
    packSize: new FormControl<number | null>(null, [Validators.required, Validators.min(0.000001)]),
    packUnit: new FormControl<UnitCode>(unit, { nonNullable: true }),
    packCount: new FormControl<number | null>(1, [Validators.required, Validators.min(0.000001)]),
    pricePerPack: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    expiryDate: new FormControl<string | null>(null),
    note: new FormControl<string | null>(null, [Validators.maxLength(200)]),
  });
}

export function readStockInForm(form: StockInForm): StockInInput {
  const v = form.getRawValue();
  return {
    packSize: v.packSize!, packUnit: v.packUnit, packCount: v.packCount!, pricePerPack: v.pricePerPack!,
    expiryDate: v.expiryDate || null, note: v.note?.trim() || null,
  };
}

/** "ซื้อมาเท่าไร ราคาเท่าไร" fields with a live cost-per-unit preview. */
@Component({
  selector: 'app-stock-in-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, BahtPipe, QtyPipe, UnitCostPipe],
  template: `
    <div [formGroup]="form()" class="space-y-4">
      <div class="grid grid-cols-[1fr_auto] gap-2">
        <label class="field">
          <span class="label">ขนาดบรรจุต่อแพ็ก</span>
          <input type="number" inputmode="decimal" class="input num" formControlName="packSize" placeholder="เช่น 1" />
        </label>
        <label class="field">
          <span class="label">หน่วย</span>
          <select class="input" formControlName="packUnit">
            @for (u of units(); track u) { <option [value]="u">{{ label(u) }}</option> }
          </select>
        </label>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <label class="field">
          <span class="label">จำนวนแพ็ก</span>
          <input type="number" inputmode="decimal" class="input num" formControlName="packCount" />
        </label>
        <label class="field">
          <span class="label">ราคาต่อแพ็ก (บาท)</span>
          <input type="number" inputmode="decimal" class="input num" formControlName="pricePerPack" placeholder="0.00" />
        </label>
      </div>

      @if (preview(); as p) {
        <div class="rounded-xl bg-soft/70 p-3 text-sm">
          <div class="flex justify-between"><span class="text-muted">รวมรับเข้า</span><span class="num">{{ p.baseQty | qty: baseUnit() : displayUnit() }}</span></div>
          <div class="flex justify-between"><span class="text-muted">จ่ายรวม</span><span class="num">{{ p.total | baht }}</span></div>
          <div class="flex justify-between font-normal text-primary-dark"><span>ตกเป็น</span><span class="num">{{ p.unitCost | unitCost: baseUnit() : displayUnit() }}</span></div>
        </div>
      }

      <label class="field">
        <span class="label">วันหมดอายุ <span class="text-muted">(ถ้ามี)</span></span>
        <input type="date" class="input" formControlName="expiryDate" />
      </label>
      <label class="field">
        <span class="label">หมายเหตุ <span class="text-muted">(ถ้ามี)</span></span>
        <input type="text" class="input" formControlName="note" placeholder="เช่น ซื้อจากร้านแม็คโคร" />
      </label>
    </div>
  `,
})
export class StockInFields {
  form = input.required<StockInForm>();
  baseUnit = input.required<UnitCode>();
  displayUnit = input.required<UnitCode>();

  protected units = computed(() => compatibleUnits(this.baseUnit()));
  protected label = unitLabel;

  private value = toSignal(
    toObservable(this.form).pipe(switchMap((f) => f.valueChanges.pipe(startWith(f.value)))),
  );

  protected preview = computed(() => {
    const v = this.value();
    if (!v?.packSize || !v.packCount || v.pricePerPack === null || v.pricePerPack === undefined || !v.packUnit) return null;
    if (v.packSize <= 0 || v.packCount <= 0 || v.pricePerPack < 0) return null;
    const baseQty = toNumber(mul(toBase(dec(v.packSize), v.packUnit), dec(v.packCount)));
    const total = toNumber(mul(dec(v.pricePerPack), dec(v.packCount)));
    return { baseQty, total, unitCost: costPerBaseUnit(total, baseQty) };
  });
}
