import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';
import { ProductRepository, SalesRepository } from '../../core/data/repositories';
import { addDaysIso, todayIso } from '../../core/dates';
import { ZERO, dec, mul, round, toNumber } from '../../core/domain/decimal';
import { toUserMessage } from '../../core/errors';
import { createLoader } from '../../core/load-state';
import { Product, Sale } from '../../core/models';
import { ActionSheetService, SheetAnchor, anchorBelow } from '../../shared/action-sheet';
import { BahtPipe, ThaiDatePipe } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { ToastService } from '../../shared/toast';
import { ProductThumb } from '../products/product-thumb';

/**
 * "บันทึกยอดขาย": type (or tap +/−) how many of each menu sold, then save once.
 * Built for entering a whole day's count in one go.
 */
@Component({
  selector: 'app-sales-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, PageHeader, Loading, ErrorState, EmptyState, ProductThumb, BahtPipe, ThaiDatePipe],
  templateUrl: './sales-page.html',
})
export class SalesPage {
  private readonly productsRepo = inject(ProductRepository);
  private readonly salesRepo = inject(SalesRepository);
  private readonly toast = inject(ToastService);
  private readonly sheet = inject(ActionSheetService);

  protected readonly today = todayIso();
  protected readonly yesterday = addDaysIso(this.today, -1);
  protected readonly anchorBelow = anchorBelow;

  protected readonly soldOn = signal(this.today);
  protected readonly qty = signal<Record<string, number>>({});
  protected readonly saving = signal(false);

  protected readonly menu = createLoader(() => this.productsRepo.list().pipe(map((list) => list.filter((p) => p.isActive))));
  protected readonly saved = createLoader(() => this.salesRepo.list(this.soldOn(), this.soldOn()));

  protected readonly lines = computed(() => {
    const s = this.menu.state();
    const q = this.qty();
    return s.status === 'ready' ? s.data.filter((p) => (q[p.id] ?? 0) > 0) : [];
  });
  protected readonly units = computed(() => this.lines().reduce((n, p) => n + this.qty()[p.id], 0));
  protected readonly total = computed(() =>
    toNumber(round(this.lines().reduce((sum, p) => sum + mul(dec(p.sellPrice), dec(this.qty()[p.id])), ZERO), 2)),
  );
  protected readonly savedTotal = computed(() => {
    const s = this.saved.state();
    return s.status === 'ready' ? s.data.reduce((n, sale) => n + sale.total, 0) : 0;
  });

  constructor() {
    // Changing the date shows that day's saved entries.
    let first = true;
    effect(() => {
      this.soldOn();
      if (first) { first = false; return; }
      untracked(() => this.saved.reload());
    });
  }

  protected setDate(value: string) {
    if (value && value <= this.today) this.soldOn.set(value);
  }

  protected qtyOf(p: Product) {
    return this.qty()[p.id] ?? 0;
  }

  protected setQty(p: Product, value: number | string | null) {
    const n = Math.max(0, Math.min(100_000, Number(value) || 0));
    this.qty.update((q) => ({ ...q, [p.id]: n }));
  }

  protected step(p: Product, by: number) {
    this.setQty(p, this.qtyOf(p) + by);
  }

  protected lineTotal(p: Product) {
    return toNumber(round(mul(dec(p.sellPrice), dec(this.qtyOf(p))), 2));
  }

  protected save() {
    const lines = this.lines();
    if (!lines.length || this.saving()) return;
    this.saving.set(true);
    this.salesRepo
      .create({ soldOn: this.soldOn(), items: lines.map((p) => ({ productId: p.id, quantity: this.qtyOf(p) })), note: null })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ sale, shortages }) => {
          this.qty.set({});
          this.saved.reload();
          this.toast.success(`บันทึกยอดขาย ${sale.total.toLocaleString('th-TH')} บาท แล้ว`, {
            label: 'เลิกทำ',
            run: () => this.cancel(sale, false),
          });
          if (shortages.length) {
            this.toast.error(
              `วัตถุดิบในแอปไม่พอ: ${shortages.map((s) => s.name).join(', ')} — ตัดเหลือ 0 ไว้ก่อน ` +
                'ควรไปที่สต็อกแล้ว "รับเข้า" หรือ "ปรับยอด" ให้ตรงของจริง',
            );
          }
        },
        error: (e) => this.toast.error(toUserMessage(e)),
      });
  }

  protected itemsText(sale: Sale) {
    return sale.items.map((i) => `${i.name} ×${i.quantity}`).join(', ');
  }

  protected openSaleMenu(sale: Sale, anchor: SheetAnchor | null) {
    this.sheet.open(
      `ขาย ${sale.total.toLocaleString('th-TH')} บาท`,
      [{ label: 'ยกเลิกรายการนี้', icon: 'trash', danger: true, run: () => this.cancel(sale, true) }],
      { subtitle: this.itemsText(sale), anchor },
    );
  }

  /** Cancels a saved sale; its stock goes back. `ask` = confirm first (not needed for the toast's undo). */
  private async cancel(sale: Sale, ask: boolean) {
    if (ask) {
      const ok = await this.sheet.confirm(
        'ยกเลิกรายการขายนี้ใช่ไหม?',
        'ยอดเงินจะหายจากรายรับ และวัตถุดิบที่ตัดไปจะคืนเข้าสต็อก',
        'ยกเลิกรายการ',
      );
      if (!ok) return;
    }
    this.salesRepo.cancel(sale.id).subscribe({
      next: () => {
        this.saved.reload();
        this.toast.success('ยกเลิกรายการขายแล้ว คืนวัตถุดิบเข้าสต็อกแล้ว');
      },
      error: (e) => this.toast.error(toUserMessage(e)),
    });
  }
}
