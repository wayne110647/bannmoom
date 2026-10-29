import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { SalesRepository } from '../../core/data/repositories';
import { addDaysIso, todayIso } from '../../core/dates';
import { toUserMessage } from '../../core/errors';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../../core/models';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { ToastService } from '../../shared/toast';

/** Money out that isn't an ingredient stock-in: gas, electricity, delivery, bags… */
@Component({
  selector: 'app-expense-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, PageHeader],
  template: `
    <app-page-header title="บันทึกรายจ่าย" subtitle="ค่าใช้จ่ายอื่นที่ไม่ใช่การซื้อวัตถุดิบเข้าสต็อก" backLink="/money" />

    <form [formGroup]="form" (ngSubmit)="submit()" class="mx-auto max-w-xl space-y-5" novalidate>
      <section class="card card-pad space-y-3">
        <span class="label">จ่ายค่าอะไร</span>
        <div class="grid grid-cols-2 gap-2">
          @for (c of categories; track c.value) {
            <button type="button" class="min-h-12 rounded-xl border px-3 text-left text-sm transition-colors"
              [class]="form.controls.category.value === c.value ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-primary-dark hover:bg-soft'"
              (click)="form.controls.category.setValue(c.value)">{{ c.label }}</button>
          }
        </div>
      </section>

      <section class="card card-pad space-y-4">
        <label class="field">
          <span class="label">จำนวนเงิน (บาท) *</span>
          <input type="number" inputmode="decimal" min="0" class="input num text-xl" formControlName="amount" placeholder="0" />
          @if (form.controls.amount.touched && form.controls.amount.invalid) {
            <span class="error-text">ใส่จำนวนเงินมากกว่า 0</span>
          }
        </label>

        <div class="field">
          <span class="label">วันที่จ่าย</span>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="chip" [class.chip-active]="form.controls.spentOn.value === today" (click)="form.controls.spentOn.setValue(today)">วันนี้</button>
            <button type="button" class="chip" [class.chip-active]="form.controls.spentOn.value === yesterday" (click)="form.controls.spentOn.setValue(yesterday)">เมื่อวาน</button>
            <input type="date" class="input min-h-9 w-auto flex-1 py-1 sm:flex-none" [max]="today" formControlName="spentOn" aria-label="เลือกวันที่" />
          </div>
        </div>

        <label class="field">
          <span class="label">หมายเหตุ <span class="text-muted">(ถ้ามี)</span></span>
          <input type="text" class="input" formControlName="note" placeholder="เช่น ค่าแก๊สถังใหญ่" maxlength="200" />
        </label>
      </section>

      <button type="submit" class="btn-primary btn-block min-h-12 text-base" [disabled]="saving()">
        @if (saving()) { กำลังบันทึก... } @else { <app-icon name="save" [size]="20" /> บันทึกรายจ่าย }
      </button>
    </form>
  `,
})
export class ExpenseFormPage {
  private readonly repo = inject(SalesRepository);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly categories = EXPENSE_CATEGORIES;
  protected readonly today = todayIso();
  protected readonly yesterday = addDaysIso(this.today, -1);
  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    category: new FormControl<ExpenseCategory>('utilities', { nonNullable: true }),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    spentOn: new FormControl(this.today, { nonNullable: true, validators: Validators.required }),
    note: new FormControl<string | null>(null, [Validators.maxLength(200)]),
  });

  protected submit() {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.toast.error('กรุณาใส่จำนวนเงิน');
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.repo
      .createExpense({ category: v.category, amount: v.amount!, spentOn: v.spentOn, note: v.note?.trim() || null })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (e) => {
          this.toast.success(`บันทึกรายจ่าย ${e.amount.toLocaleString('th-TH')} บาท แล้ว`);
          this.router.navigate(['/money'], { replaceUrl: true });
        },
        error: (e) => this.toast.error(toUserMessage(e)),
      });
  }
}
