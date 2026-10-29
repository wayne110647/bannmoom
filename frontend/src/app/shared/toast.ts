import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { Icon } from './icon';

/** A button inside the toast, e.g. "เลิกทำ" after a delete. */
export interface ToastAction {
  label: string;
  run: () => void;
}

interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
  action?: ToastAction;
}

/** Short feedback messages. Call success() only after the API has confirmed the save. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  /** With an action (undo), the toast stays longer so there is time to tap it. */
  success(text: string, action?: ToastAction) { this.show('success', text, action); }
  error(text: string) { this.show('error', text); }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  runAction(t: Toast) {
    this.dismiss(t.id);
    t.action?.run();
  }

  private show(kind: Toast['kind'], text: string, action?: ToastAction) {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, kind, text, action }]);
    setTimeout(() => this.dismiss(id), kind === 'error' || action ? 7000 : 3000);
  }
}

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4' },
  template: `
    @for (t of toast.toasts(); track t.id) {
      <div role="status" aria-live="polite"
        class="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-lg"
        [class.bg-success]="t.kind === 'success'" [class.bg-danger]="t.kind === 'error'">
        <app-icon [name]="t.kind === 'success' ? 'check' : 'alert'" />
        <span class="flex-1">{{ t.text }}</span>
        @if (t.action) {
          <button type="button" class="-my-1 min-h-9 rounded-xl bg-white/20 px-3.5 font-medium hover:bg-white/30" (click)="toast.runAction(t)">
            {{ t.action.label }}
          </button>
        }
        <button type="button" class="-mr-1 p-1 opacity-80 hover:opacity-100" (click)="toast.dismiss(t.id)" aria-label="ปิด">
          <app-icon name="x" [size]="16" />
        </button>
      </div>
    }
  `,
})
export class Toasts {
  protected toast = inject(ToastService);
}
