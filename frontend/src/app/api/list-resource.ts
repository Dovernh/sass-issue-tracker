import { type ResourceRef } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { type Observable } from 'rxjs';

/**
 * Wraps a list-returning GET (typically a generated proxy method) in a
 * reloadable, signal-backed resource with an empty-array default.
 *
 * Lives outside the generated proxies on purpose: the proxy is pure transport
 * (`Observable`), while resource lifecycle/`reload()` is per-consumer view-state.
 * Call it in an injection context (e.g. a component field initializer).
 *
 * @example
 * readonly issues = listResource(() =>
 *   this.#issueService.getIssues().pipe(map((r) => r.issues)),
 * );
 * // issues.value() -> Item[], issues.isLoading(), issues.error(), issues.reload()
 */
export function listResource<T>(stream: () => Observable<T[]>): ResourceRef<T[]> {
  return rxResource({ stream, defaultValue: [] as T[] });
}
