import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { form, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';

import { type Language } from '../../../api/proxies/issueTrackerAPI.schemas';
import { LanguageService } from '../../../api/proxies/language/language.service';
import { LanguageService as LocaleService } from '../../../core/language.service';
import { NotificationService } from '../../../core/notification.service';
import { FORM_IMPORTS } from '../../../shared/form-imports';
import { CreateEditLanguageData } from './create-edit-language-data';

/**
 * Create/edit form for one of the org's languages. `selectedLanguage` switches
 * between add (null) and edit. `code` is the per-org primary key, so it's
 * immutable on edit. Enabling/disabling is done from the grid, not here.
 */
@Component({
  selector: 'app-create-edit-language',
  imports: [...FORM_IMPORTS],
  templateUrl: './create-edit-language.html',
  styleUrl: './create-edit-language.scss',
})
export class CreateEditLanguage {
  readonly #languageApi = inject(LanguageService);
  readonly #locale = inject(LocaleService);
  readonly #notify = inject(NotificationService);

  readonly selectedLanguage = input<Language | null>(null);
  readonly added = output<boolean>();
  readonly cancelled = output<void>();

  protected readonly isEdit = computed(() => this.selectedLanguage() !== null);

  readonly #model = linkedSignal<CreateEditLanguageData>(() => {
    const l = this.selectedLanguage();
    return {
      code: l?.code ?? '',
      name: l?.name ?? '',
      nativeName: l?.nativeName ?? '',
      sortOrder: l?.sortOrder ?? 0,
    };
  });

  protected createForm = form(
    this.#model,
    (s) => {
      required(s.code, { message: 'Code is required' });
      required(s.name, { message: 'Name is required' });
      required(s.nativeName, { message: 'Native name is required' });
    },
    {
      submission: {
        action: async (f) => {
          const v = f().value();
          const l = this.selectedLanguage();
          const sortOrder = Number(v.sortOrder) || 0;
          try {
            if (l) {
              await firstValueFrom(
                this.#languageApi.updateLanguage(l.code, {
                  name: v.name.trim(),
                  nativeName: v.nativeName.trim(),
                  sortOrder,
                }),
              );
              this.#notify.success('Language updated.');
            } else {
              await firstValueFrom(
                this.#languageApi.postLanguage({
                  code: v.code.trim().toLowerCase(),
                  name: v.name.trim(),
                  nativeName: v.nativeName.trim(),
                  sortOrder,
                }),
              );
              this.#notify.success('Language added.');
            }
            // Keep the switcher's language list in sync.
            this.#locale.loadAvailable();
            this.added.emit(true);
          } catch {
            // The error interceptor already surfaced the failure as a toast.
          }
        },
      },
    },
  );
}
