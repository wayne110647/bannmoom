import { DestroyRef, Signal, inject, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { toUserMessage } from './errors';

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

export interface Loader<T> {
  state: Signal<LoadState<T>>;
  reload(): void;
}

/**
 * Load data into a signal with loading / error / ready states.
 * Must be called in an injection context (e.g. a component field initializer).
 */
export function createLoader<T>(source: () => Observable<T>): Loader<T> {
  const state = signal<LoadState<T>>({ status: 'loading' });
  let sub: Subscription | undefined;

  const reload = () => {
    sub?.unsubscribe();
    state.set({ status: 'loading' });
    sub = source().subscribe({
      next: (data) => state.set({ status: 'ready', data }),
      error: (e) => state.set({ status: 'error', message: toUserMessage(e) }),
    });
  };

  inject(DestroyRef).onDestroy(() => sub?.unsubscribe());
  reload();
  return { state: state.asReadonly(), reload };
}
