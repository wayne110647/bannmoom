import { ChangeDetectionStrategy, Component, ElementRef, Injectable, afterRenderEffect, computed, inject, signal } from '@angular/core';
import { Icon, IconName } from './icon';

export interface SheetAction {
  label: string;
  icon: IconName;
  run: () => void;
  /** Red, and always listed last — for delete. */
  danger?: boolean;
}

/** Where the menu was opened (finger or cursor); on desktop the menu pops up there. */
export interface SheetAnchor {
  x: number;
  y: number;
}

interface MenuSheet {
  kind: 'menu';
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  anchor: SheetAnchor | null;
}

interface ConfirmSheet {
  kind: 'confirm';
  title: string;
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
}

/**
 * iOS-style menus with big, thumb-friendly buttons: a bottom sheet on phones, a small popover on desktop.
 * One sheet at a time; the host component lives in the app shell.
 */
@Injectable({ providedIn: 'root' })
export class ActionSheetService {
  readonly sheet = signal<MenuSheet | ConfirmSheet | null>(null);

  open(title: string, actions: SheetAction[], options: { subtitle?: string; anchor?: SheetAnchor | null } = {}) {
    this.cancelPending();
    this.sheet.set({ kind: 'menu', title, actions, subtitle: options.subtitle, anchor: options.anchor ?? null });
  }

  /** Resolves true only when the red confirm button is tapped. */
  confirm(title: string, message: string, confirmLabel = 'ลบ'): Promise<boolean> {
    this.cancelPending();
    return new Promise((resolve) => this.sheet.set({ kind: 'confirm', title, message, confirmLabel, resolve }));
  }

  close() {
    this.cancelPending();
    this.sheet.set(null);
  }

  /** Run an action after the menu is gone, so a following confirm sheet replaces it cleanly. */
  choose(action: SheetAction) {
    this.sheet.set(null);
    action.run();
  }

  answer(ok: boolean) {
    const s = this.sheet();
    this.sheet.set(null);
    if (s?.kind === 'confirm') s.resolve(ok);
  }

  private cancelPending() {
    const s = this.sheet();
    if (s?.kind === 'confirm') s.resolve(false);
  }
}

const POPOVER_WIDTH = 256;

/** Anchor for a "⋯" button: the popover opens right-aligned under it (works for keyboard clicks too). */
export function anchorBelow(event: Event): SheetAnchor {
  const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return { x: r.right - POPOVER_WIDTH, y: r.bottom + 4 };
}

@Component({
  selector: 'app-action-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '(document:keydown.escape)': 'svc.close()' },
  template: `
    @if (svc.sheet(); as s) {
      <div class="fixed inset-0 z-50" role="presentation">
        <button type="button" class="animate-fade-in absolute inset-0 size-full cursor-default bg-ink/35 backdrop-blur-[2px]"
          aria-label="ปิด" tabindex="-1" (click)="s.kind === 'confirm' ? svc.answer(false) : svc.close()"></button>

        <div #panel role="dialog" aria-modal="true" [attr.aria-label]="s.title" [class]="panelClass()" [style]="popoverStyle()">
          @if (s.kind === 'menu') {
            <div class="rounded-3xl bg-surface/95 shadow-xl backdrop-blur lg:rounded-2xl">
              <div class="border-b border-line px-5 pt-4 pb-3 text-center lg:px-4 lg:pt-3 lg:pb-2.5 lg:text-left">
                <p class="truncate font-medium text-primary-dark">{{ s.title }}</p>
                @if (s.subtitle) { <p class="truncate text-sm text-muted">{{ s.subtitle }}</p> }
              </div>
              <ul class="divide-y divide-line">
                @for (a of s.actions; track a.label) {
                  <li>
                    <button type="button" (click)="svc.choose(a)"
                      class="flex min-h-14 w-full items-center gap-3.5 px-5 text-left text-base hover:bg-soft/60 active:bg-soft lg:min-h-11 lg:px-4 lg:text-sm"
                      [class]="a.danger ? 'text-danger' : 'text-ink'">
                      <app-icon [name]="a.icon" [size]="22" />
                      <span class="flex-1">{{ a.label }}</span>
                    </button>
                  </li>
                }
              </ul>
            </div>
            <button type="button" (click)="svc.close()"
              class="mt-2 min-h-14 w-full rounded-3xl bg-surface text-base font-medium text-primary-dark shadow-xl active:bg-soft lg:hidden">
              ยกเลิก
            </button>
          } @else {
            <div class="rounded-3xl bg-surface p-5 text-center shadow-xl">
              <span class="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-danger/10 text-danger">
                <app-icon name="trash" [size]="26" />
              </span>
              <p class="text-lg font-medium text-primary-dark">{{ s.title }}</p>
              <p class="mt-1 text-sm text-muted">{{ s.message }}</p>
              <div class="mt-5 flex flex-col gap-2 lg:flex-row-reverse">
                <button type="button" class="btn-danger min-h-13 flex-1 text-base" (click)="svc.answer(true)">
                  <app-icon name="trash" [size]="20" /> {{ s.confirmLabel }}
                </button>
                <button type="button" class="btn-secondary min-h-13 flex-1 text-base" (click)="svc.answer(false)">ยกเลิก</button>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class ActionSheet {
  protected readonly svc = inject(ActionSheetService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Desktop with a known pointer position → popover next to it; everything else → bottom sheet / centred dialog. */
  private readonly asPopover = computed(() => {
    const s = this.svc.sheet();
    return s?.kind === 'menu' && s.anchor !== null && window.matchMedia('(min-width: 1024px)').matches;
  });

  protected readonly panelClass = computed(() => {
    if (this.asPopover()) return 'animate-pop-in absolute';
    const base = 'absolute inset-x-0 bottom-0 mx-auto w-full max-w-md px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]';
    return `${base} animate-sheet-up lg:animate-pop-in lg:inset-y-0 lg:my-auto lg:h-fit lg:pb-0`;
  });

  protected readonly popoverStyle = computed(() => {
    const s = this.svc.sheet();
    if (!this.asPopover() || s?.kind !== 'menu' || !s.anchor) return '';
    const left = Math.min(Math.max(8, s.anchor.x), window.innerWidth - POPOVER_WIDTH - 8);
    // Rows are ~44px; flip above the pointer when there isn't room below.
    const height = 64 + s.actions.length * 44;
    const top = s.anchor.y + height + 8 > window.innerHeight ? Math.max(8, s.anchor.y - height) : s.anchor.y;
    return `left:${left}px;top:${top}px;width:${POPOVER_WIDTH}px`;
  });

  constructor() {
    // Move keyboard focus into the sheet so Tab/Enter and screen readers start there.
    afterRenderEffect(() => {
      if (this.svc.sheet()) this.host.nativeElement.querySelector<HTMLButtonElement>('[role=dialog] button')?.focus();
    });
  }
}
