import { Component, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';

import { listResource } from '../../api/list-resource';
import { CategoryService } from '../../api/proxies/category/category.service';
import { LanguageService } from '../../api/proxies/language/language.service';
import { AuthService } from '../../auth/auth.service';
import { NotificationService } from '../../core/notification.service';
import { OptionLabelsService } from '../../core/option-labels.service';
import { ConfirmService } from '../../shared/components/confirm/confirm.service';
import {
  type EditorLanguage,
  type EditorOption,
  type OptionDraft,
  OptionListEditor,
  type OptionPatch,
} from '../../shared/components/option-list-editor/option-list-editor';

/**
 * Admin → Category. A master–detail editor (one reusable pattern shared with
 * Priorities): a narrow option list + a per-language translation panel that
 * scales to any number of languages. Reads/writes flow through the shared
 * OptionLabelsService cache so every consumer stays in sync.
 */
@Component({
  selector: 'app-admin-category',
  imports: [OptionListEditor, TranslatePipe],
  templateUrl: './admin-category.html',
  styleUrl: './admin-category.scss',
})
export class AdminCategory {
  readonly #categoryService = inject(CategoryService);
  readonly #languageApi = inject(LanguageService);
  readonly #optionLabels = inject(OptionLabelsService);
  readonly #notify = inject(NotificationService);
  readonly #confirm = inject(ConfirmService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #auth = inject(AuthService);

  /** Org-settings managers can add/edit/remove; others get a read-only view. */
  protected readonly canManage = computed(() => this.#auth.hasPermission('org:settings:manage'));

  protected readonly categories = this.#optionLabels.categories;

  protected readonly items = computed<EditorOption[]>(() =>
    this.categories
      .value()
      .map((c) => ({ id: c.id, key: c.key, sortOrder: c.sortOrder, labels: { ...c.labels } })),
  );

  readonly #languages = listResource(() =>
    this.#languageApi.getLanguages().pipe(map((res) => res.languages)),
  );
  protected readonly languages = computed<EditorLanguage[]>(() =>
    this.#languages.value().map((l) => ({ code: l.code, nativeName: l.nativeName })),
  );

  protected onCreate(d: OptionDraft): void {
    const label = d.labels['en'] ?? Object.values(d.labels)[0] ?? d.key;
    this.#categoryService
      .postCategory({ key: d.key, label, labels: d.labels, sortOrder: d.sortOrder })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.success('Category added.');
          this.#optionLabels.reloadCategories();
        },
      });
  }

  protected onUpdate(e: { id: number; patch: OptionPatch }): void {
    this.#categoryService
      .updateCategory(e.id, e.patch)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({ next: () => this.#optionLabels.reloadCategories() });
  }

  protected async onRemove(id: number): Promise<void> {
    const c = this.categories.value().find((x) => x.id === id);
    const ok = await this.#confirm.confirm({
      title: 'Remove category',
      message: `Remove "${c?.key}"? Its label translations are deleted too.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    this.#categoryService
      .deleteCategory(id)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.success('Category removed.');
          this.#optionLabels.reloadCategories();
        },
      });
  }
}
