import { inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { LanguageService as LanguageApi } from '../api/proxies/language/language.service';
import { StorageService } from './storage.service';

/** Fallback locale set used until /api/languages responds (or if it fails). */
export const LANGUAGES = ['en', 'es', 'uk'] as const;
export type Language = (typeof LANGUAGES)[number];

/** A selectable UI language (code + endonym for the switcher). */
export interface UiLanguage {
  code: string;
  nativeName: string;
}

/**
 * Shipped locales with their endonyms — the fallback shown until /api/languages
 * responds (or if it fails). Endonyms (not codes) so the switcher reads properly
 * even before the org's language list loads.
 */
const FALLBACK_LANGUAGES: readonly UiLanguage[] = [
  { code: 'en', nativeName: 'English' },
  { code: 'es', nativeName: 'Español' },
  { code: 'uk', nativeName: 'Українська' },
];

const KEY = 'lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly #translate = inject(TranslateService);
  readonly #storage = inject(StorageService);
  readonly #languageApi = inject(LanguageApi);

  // Data-driven from the backend; starts with the shipped fallback (proper
  // endonyms) so the switcher renders immediately, then fills in from the org's
  // enabled list once /api/languages responds.
  readonly #available = signal<UiLanguage[]>([...FALLBACK_LANGUAGES]);
  readonly available = this.#available.asReadonly();

  // Reactive so bindings (e.g. the navbar selector) reflect the active language
  // immediately — `translate.use()` resolves asynchronously and doesn't trigger
  // change detection on its own.
  readonly #current = signal<string>('en');
  readonly current = this.#current.asReadonly();

  // Fires after each language file finishes loading. Depend on it to re-resolve
  // strings translated imperatively in TS — e.g. ag-grid `headerName` / action
  // labels — which, unlike the template `translate` pipe, don't auto-update on a
  // language change. `current()` flips synchronously (before the file loads), so
  // it's the wrong trigger for `instant()`; onLangChange is the right one.
  readonly translation = toSignal(this.#translate.onLangChange);

  /** Set the active language from storage. Safe to call before sign-in. */
  init(): void {
    const saved = this.#storage.get<string>(KEY);
    this.use(saved ?? 'en');
  }

  /**
   * Load the supported-language list for the switcher. Requires auth, so call it
   * once signed in (e.g. from the navbar). Keeps the fallback list on failure.
   */
  loadAvailable(): void {
    this.#languageApi
      .getLanguages()
      .pipe(catchError(() => of({ languages: [] })))
      .subscribe((res) => {
        if (res.languages.length) {
          this.#available.set(
            res.languages.map((l) => ({ code: l.code, nativeName: l.nativeName })),
          );
        }
      });
  }

  use(lang: string): void {
    this.#translate.use(lang);
    this.#storage.set(KEY, lang);
    this.#current.set(lang);
  }
}
