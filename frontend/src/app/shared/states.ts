import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon, IconName } from './icon';

@Component({
  selector: 'app-loading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3" role="status" aria-live="polite">
      <span class="sr-only">กำลังโหลด...</span>
      @for (row of rowsArray(); track $index) {
        <div class="card h-20 animate-pulse bg-soft/60"></div>
      }
    </div>
  `,
})
export class Loading {
  rows = input(3);
  protected rowsArray = () => Array.from({ length: this.rows() });
}

@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="card card-pad flex flex-col items-center gap-3 py-8 text-center" role="alert">
      <span class="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <app-icon name="alert" [size]="24" />
      </span>
      <p class="text-sm text-ink">{{ message() }}</p>
      <button type="button" class="btn-secondary" (click)="retry.emit()">
        <app-icon name="refresh" [size]="18" /> ลองใหม่
      </button>
    </div>
  `,
})
export class ErrorState {
  message = input.required<string>();
  retry = output<void>();
}

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="card card-pad flex flex-col items-center gap-2 py-10 text-center">
      <span class="flex size-14 items-center justify-center rounded-full bg-soft text-primary">
        <app-icon [name]="icon()" [size]="26" />
      </span>
      <p class="font-normal text-primary-dark">{{ title() }}</p>
      @if (detail()) {
        <p class="max-w-xs text-sm text-muted">{{ detail() }}</p>
      }
      <div class="mt-2"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  title = input.required<string>();
  detail = input<string>();
  icon = input<IconName>('package');
}
