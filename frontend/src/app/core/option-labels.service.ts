import { computed, inject,Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';

import { listResource } from '../api/list-resource';
import { CategoryService } from '../api/proxies/category/category.service';
import { PriorityService } from '../api/proxies/priority/priority.service';
import { LanguageService } from './language.service';

export type OptionKind = 'priority' | 'category';

/**
 * Local translation cache + resolver for org-configured priority/category
 * labels. Each option carries labels for every locale, so loading the lists
 * caches all languages at once; switching language re-resolves from the cache
 * with no refetch. `label()` resolves in order: cached per-locale label → the
 * option's default label → the static i18n file → the raw value.
 */
@Injectable({ providedIn: 'root' })
export class OptionLabelsService {
  readonly #priorityService = inject(PriorityService);
  readonly #categoryService = inject(CategoryService);
  readonly #language = inject(LanguageService);
  readonly #translate = inject(TranslateService);

  /** Cached option lists (all locales), reloadable. Org-scoped. */
  readonly priorities = listResource(() =>
    this.#priorityService.getPriorities().pipe(map((res) => res.priorities)),
  );
  readonly categories = listResource(() =>
    this.#categoryService.getCategories().pipe(map((res) => res.categories)),
  );

  // `hasValue()` guards against reading a resource that's still loading or in an
  // error state — `.value()` throws in those cases, which would crash change
  // detection wherever a label is resolved. On error/loading we fall back to an
  // empty map; `label()` then resolves via the static i18n files / raw value.
  readonly #byKey = computed(() => ({
    priority: new Map(
      (this.priorities.hasValue() ? this.priorities.value() : []).map((o) => [o.key, o]),
    ),
    category: new Map(
      (this.categories.hasValue() ? this.categories.value() : []).map((o) => [o.key, o]),
    ),
  }));

  /** Refetch both lists — call after an org switch. */
  reload(): void {
    this.priorities.reload();
    this.categories.reload();
  }

  /** Refetch just the priority cache — call after a priority CRUD. */
  reloadPriorities(): void {
    this.priorities.reload();
  }

  /** Refetch just the category cache — call after a category CRUD. */
  reloadCategories(): void {
    this.categories.reload();
  }

  /** Localized label for an option key/slug (reactive to the active language). */
  label(kind: OptionKind, value: string): string {
    const option = this.#byKey()[kind].get(value);
    if (option) {
      return option.labels[this.#language.current()] ?? option.label;
    }
    // Unknown value (e.g. an option removed since the issue was tagged): try the
    // static i18n files, then fall back to the raw value.
    const key = `issues.${kind === 'priority' ? 'priorities' : 'categories'}.${value}`;
    const fromFile = this.#translate.instant(key);
    return fromFile === key ? value : fromFile;
  }
}
