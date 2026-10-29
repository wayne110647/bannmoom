import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { Icon } from './icon';

interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
}

/** Short feedback messages. Call success() only after the API has confirmed the save. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  success(text: string) { this.show('success', text); }
  error(text: string) { this.show('error', text); }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(kind: Toast['kind'], text: string) {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), kind === 'error' ? 6000 : 3000);
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
