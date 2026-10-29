import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { toUserMessage } from '../core/errors';
import { ActionSheetService } from './action-sheet';
import { ToastService } from './toast';

export interface DeleteRequest {
  name: string;
  /** Extra line in the confirm sheet, e.g. what else goes with it. */
  detail?: string;
  remove: () => Observable<unknown>;
  restore: () => Observable<unknown>;
  onRemoved: () => void;
  onRestored: () => void;
}

/**
 * The one delete flow used everywhere: ask once (naming the item), delete,
 * then offer "เลิกทำ" in the toast in case it was a mis-tap.
 * Call in an injection context (a component field initializer).
 */
export function injectConfirmDelete() {
  const sheet = inject(ActionSheetService);
  const toast = inject(ToastService);

  return async (req: DeleteRequest) => {
    const ok = await sheet.confirm(
      `ลบ "${req.name}" ใช่ไหม?`,
      req.detail ?? 'ถ้ากดผิด กด "เลิกทำ" ได้ทันทีหลังลบ',
    );
    if (!ok) return;
    req.remove().subscribe({
      next: () => {
        req.onRemoved();
        toast.success(`ลบ "${req.name}" แล้ว`, {
          label: 'เลิกทำ',
          run: () =>
            req.restore().subscribe({
              next: () => {
                req.onRestored();
                toast.success(`กู้คืน "${req.name}" แล้ว`);
              },
              error: (e) => toast.error(toUserMessage(e)),
            }),
        });
      },
      error: (e) => toast.error(toUserMessage(e)),
    });
  };
}
