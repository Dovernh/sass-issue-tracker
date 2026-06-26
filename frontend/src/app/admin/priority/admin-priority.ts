import { Component, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';

import { listResource } from '../../api/list-resource';
import { LanguageService } from '../../api/proxies/language/language.service';
import { PriorityService } from '../../api/proxies/priority/priority.service';
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
 * Admin → Priority. A master–detail editor (one reusable pattern shared with
 * Categories): a narrow option list + a per-language translation panel that
 * scales to any number of languages. Reads/writes flow through the shared
 * OptionLabelsService cache so every consumer stays in sync.
 */
@Component({
  selector: 'app-admin-priority',
  imports: [OptionListEditor, TranslatePipe],
  templateUrl: './admin-priority.html',
  styleUrl: './admin-priority.scss',
})
export class AdminPriority {
  readonly #priorityService = inject(PriorityService);
  readonly #languageApi = inject(LanguageService);
  readonly #optionLabels = inject(OptionLabelsService);
  readonly #notify = inject(NotificationService);
  readonly #confirm = inject(ConfirmService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #auth = inject(AuthService);

  /** Org-settings managers can add/edit/remove; others get a read-only view. */
  protected readonly canManage = computed(() => this.#auth.hasPermission('org:settings:manage'));

  protected readonly priorities = this.#optionLabels.priorities;

  protected readonly items = computed<EditorOption[]>(() =>
    this.priorities
      .value()
      .map((p) => ({ id: p.id, key: p.key, sortOrder: p.sortOrder, labels: { ...p.labels } })),
  );

  readonly #languages = listResource(() =>
    this.#languageApi.getLanguages().pipe(map((res) => res.languages)),
  );
  protected readonly languages = computed<EditorLanguage[]>(() =>
    this.#languages.value().map((l) => ({ code: l.code, nativeName: l.nativeName })),
  );

  protected onCreate(d: OptionDraft): void {
    const label = d.labels['en'] ?? Object.values(d.labels)[0] ?? d.key;
    this.#priorityService
      .postPriority({ key: d.key, label, labels: d.labels, sortOrder: d.sortOrder })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.success('Priority added.');
          this.#optionLabels.reloadPriorities();
        },
      });
  }

  protected onUpdate(e: { id: number; patch: OptionPatch }): void {
    this.#priorityService
      .updatePriority(e.id, e.patch)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({ next: () => this.#optionLabels.reloadPriorities() });
  }

  protected async onRemove(id: number): Promise<void> {
    const p = this.priorities.value().find((x) => x.id === id);
    const ok = await this.#confirm.confirm({
      title: 'Remove priority',
      message: `Remove "${p?.key}"? Its label translations are deleted too.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    this.#priorityService
      .deletePriority(id)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.success('Priority removed.');
          this.#optionLabels.reloadPriorities();
        },
      });
  }
}
