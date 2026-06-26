import { DestroyRef, inject, type ResourceRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type Observable, type Subscription } from 'rxjs';

import { listResource } from './list-resource';

/**
 * A small reloadable list store over a generated proxy.
 *
 * `items` is a signal-backed, reloadable resource (the GET). `mutate()` runs any
 * write Observable — create, update, delete, status change, bulk op, etc. — and
 * refreshes the list on success. It's not limited to specific verbs: keep the
 * typed proxy call at the call site and hand its Observable to `mutate()`.
 *
 * Call in an injection context (e.g. a component field initializer).
 *
 * @example
 * readonly issues = listStore(() =>
 *   this.#issueService.getIssues().pipe(map((r) => r.issues)),
 * );
 * // read:    issues.items.value() / isLoading() / error()
 * // write:   issues.mutate(this.#issueService.deleteIssue(id))
 * //          issues.mutate(this.#issueService.postIssue(body))
 * //          issues.mutate(this.#issueService.updateIssue(id, patch))
 */
export function listStore<T>(fetch: () => Observable<T[]>) {
  const destroyRef = inject(DestroyRef);
  const items: ResourceRef<T[]> = listResource(fetch);

  return {
    items,
    reload: () => items.reload(),
    /** Run a write, refresh the list on success, and auto-unsubscribe. */
    mutate: <R>(op: Observable<R>, onSuccess?: (result: R) => void): Subscription =>
      op.pipe(takeUntilDestroyed(destroyRef)).subscribe((result) => {
        onSuccess?.(result);
        items.reload();
      }),
  };
}
