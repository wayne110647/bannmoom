import { DestroyRef, Directive, ElementRef, inject, input, output, signal } from '@angular/core';
import { SheetAnchor } from './action-sheet';

const MOVE_TOLERANCE_PX = 10;

/**
 * Press and hold (touch) or right-click (mouse) to open an item's menu, like iOS.
 * The element shrinks slightly while held so it's clear something is about to happen,
 * and the tap that ends a long press doesn't also open the link underneath.
 */
@Directive({
  selector: '[appLongPress]',
  host: {
    // Written as a data-attribute variant so Tailwind sees the class in this string and generates it.
    class: 'select-none transition-transform duration-200 [-webkit-touch-callout:none] data-pressing:scale-[0.97]',
    '[attr.data-pressing]': 'pressing() || null',
    '(pointerdown)': 'start($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'cancel()',
    '(pointercancel)': 'cancel()',
    '(pointerleave)': 'cancel()',
    '(contextmenu)': 'contextMenu($event)',
  },
})
export class LongPress {
  readonly appLongPress = output<SheetAnchor>();
  readonly longPressMs = input(450);

  protected readonly pressing = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private origin: SheetAnchor | null = null;
  private pointerType = 'mouse';
  private suppressClick = false;

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // Capture phase, so it runs before routerLink handles the click.
    const onClick = (e: MouseEvent) => {
      if (!this.suppressClick) return;
      this.suppressClick = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    el.addEventListener('click', onClick, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      el.removeEventListener('click', onClick, { capture: true });
      clearTimeout(this.timer);
    });
  }

  protected start(e: PointerEvent) {
    this.pointerType = e.pointerType;
    if (e.pointerType === 'mouse' || !e.isPrimary) return; // mouse uses right-click instead
    this.suppressClick = false;
    this.origin = { x: e.clientX, y: e.clientY };
    this.pressing.set(true);
    this.timer = setTimeout(() => this.fire(), this.longPressMs());
  }

  protected move(e: PointerEvent) {
    if (!this.origin) return;
    if (Math.hypot(e.clientX - this.origin.x, e.clientY - this.origin.y) > MOVE_TOLERANCE_PX) this.cancel();
  }

  protected cancel() {
    clearTimeout(this.timer);
    this.origin = null;
    this.pressing.set(false);
  }

  /** Mobile browsers also send contextmenu after a long touch; only the mouse should open from it. */
  protected contextMenu(e: MouseEvent) {
    e.preventDefault();
    if (this.pointerType === 'mouse') this.appLongPress.emit({ x: e.clientX, y: e.clientY });
  }

  private fire() {
    const at = this.origin!;
    this.cancel();
    this.suppressClick = true;
    navigator.vibrate?.(12);
    this.appLongPress.emit(at);
  }
}
