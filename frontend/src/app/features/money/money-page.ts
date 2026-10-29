import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalesRepository } from '../../core/data/repositories';
import { addDaysIso, monthStartIso, todayIso } from '../../core/dates';
import { toUserMessage } from '../../core/errors';
import { createLoader } from '../../core/load-state';
import { LedgerEntry } from '../../core/models';
import { ActionSheetService, SheetAnchor, anchorBelow } from '../../shared/action-sheet';
import { injectConfirmDelete } from '../../shared/confirm-delete';
import { BahtPipe, ThaiDatePipe } from '../../shared/format';
import { Icon, IconName } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { ToastService } from '../../shared/toast';

type Period = 'today' | 'week' | 'month' | 'lastMonth';

const ENTRY_ICON: Record<LedgerEntry['kind'], IconName> = { sale: 'bag', expense: 'wallet', purchase: 'stock-in' };

/** รายรับ-รายจ่าย: money in (sales) vs money out (ingredients bought + other expenses) for a period. */
@Component({
  selector: 'app-money-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, PageHeader, Loading, ErrorState, EmptyState, BahtPipe, ThaiDatePipe],
  templateUrl: './money-page.html',
})
export class MoneyPage {
  private readonly repo = inject(SalesRepository);
  private readonly sheet = inject(ActionSheetService);
  private readonly toast = inject(ToastService);
  private readonly confirmDelete = injectConfirmDelete();

  protected readonly anchorBelow = anchorBelow;
  protected readonly entryIcon = ENTRY_ICON;
  protected readonly today = todayIso();
  protected readonly periods: { value: Period; label: string }[] = [
    { value: 'today', label: 'วันนี้' },
    { value: 'week', label: '7 วันล่าสุด' },
    { value: 'month', label: 'เดือนนี้' },
    { value: 'lastMonth', label: 'เดือนที่แล้ว' },
  ];
  protected readonly period = signal<Period>('today');

  protected readonly range = computed(() => {
    const t = this.today;
    switch (this.period()) {
      case 'today': return { from: t, to: t };
      case 'week': return { from: addDaysIso(t, -6), to: t };
      case 'month': return { from: monthStartIso(t), to: t };
      case 'lastMonth': return { from: monthStartIso(t, -1), to: addDaysIso(monthStartIso(t), -1) };
    }
  });

  protected readonly ledger = createLoader(() => this.repo.ledger(this.range().from, this.range().to));

  /** Entries grouped under a heading per day. */
  protected readonly days = computed(() => {
    const s = this.ledger.state();
    if (s.status !== 'ready') return [];
    const groups: { date: string; entries: LedgerEntry[]; total: number }[] = [];
    for (const e of s.data.entries) {
      let g = groups.at(-1);
      if (!g || g.date !== e.date) groups.push((g = { date: e.date, entries: [], total: 0 }));
      g.entries.push(e);
      g.total += e.amount;
    }
    return groups;
  });

  constructor() {
    let first = true;
    effect(() => {
      this.period();
      if (first) { first = false; return; }
      untracked(() => this.ledger.reload());
    });
  }

  private readonly baht = new BahtPipe();

  /** "+฿200.00" / "−฿120.00" — the sign before the currency reads more naturally than "฿-120.00". */
  protected signed(amount: number, plus = true) {
    const sign = amount < 0 ? '−' : plus && amount > 0 ? '+' : '';
    return sign + this.baht.transform(Math.abs(amount));
  }

  protected openEntryMenu(e: LedgerEntry, anchor: SheetAnchor | null) {
    if (e.kind === 'expense') {
      this.sheet.open(e.title, [{ label: 'ลบรายจ่ายนี้', icon: 'trash', danger: true, run: () => this.removeExpense(e) }], {
        subtitle: `${Math.abs(e.amount).toLocaleString('th-TH')} บาท`, anchor,
      });
    } else if (e.kind === 'sale') {
      this.sheet.open('ขายขนม', [{ label: 'ยกเลิกรายการขายนี้', icon: 'trash', danger: true, run: () => this.cancelSale(e) }], {
        subtitle: e.detail ?? undefined, anchor,
      });
    }
  }

  private removeExpense(e: LedgerEntry) {
    this.confirmDelete({
      name: `${e.title} ${Math.abs(e.amount).toLocaleString('th-TH')} บาท`,
      remove: () => this.repo.removeExpense(e.id),
      restore: () => this.repo.restoreExpense(e.id),
      onRemoved: () => this.ledger.reload(),
      onRestored: () => this.ledger.reload(),
    });
  }

  private async cancelSale(e: LedgerEntry) {
    const ok = await this.sheet.confirm(
      'ยกเลิกรายการขายนี้ใช่ไหม?',
      'ยอดเงินจะหายจากรายรับ และวัตถุดิบที่ตัดไปจะคืนเข้าสต็อก',
      'ยกเลิกรายการ',
    );
    if (!ok) return;
    this.repo.cancel(e.id).subscribe({
      next: () => {
        this.ledger.reload();
        this.toast.success('ยกเลิกรายการขายแล้ว คืนวัตถุดิบเข้าสต็อกแล้ว');
      },
      error: (err) => this.toast.error(toUserMessage(err)),
    });
  }
}
