import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ColDef } from 'ag-grid-community';
import { map } from 'rxjs';

import { listStore } from '../../api/list-store';
import { type Language } from '../../api/proxies/issueTrackerAPI.schemas';
import { LanguageService } from '../../api/proxies/language/language.service';
import { LanguageService as LocaleService } from '../../core/language.service';
import { ActionsMenu } from '../../shared/components/actions-menu/actions-menu';
import { ConfirmService } from '../../shared/components/confirm/confirm.service';
import { Grid, type GridAction, type GridActionEvent } from '../../shared/components/grid/grid';
import { Modal } from '../../shared/components/modal/modal';
import { Permissions } from '../../shared/directives/permissions';
import { CreateEditLanguage } from './create-edit-language/create-edit-language';

/**
 * Admin → Languages. A grid of the org's languages: add / edit / remove, plus a
 * per-row enable/disable toggle. Disabling drops a language from the switcher but
 * keeps it here; removing deletes it (and its option-label translations).
 */
@Component({
  selector: 'app-admin-language',
  imports: [Grid, TranslatePipe, ActionsMenu, Modal, CreateEditLanguage, Permissions],
  templateUrl: './admin-language.html',
  styleUrl: './admin-language.scss',
})
export class AdminLanguage {
  readonly #languageApi = inject(LanguageService);
  readonly #locale = inject(LocaleService);
  readonly #confirm = inject(ConfirmService);
  readonly #translate = inject(TranslateService);

  private readonly grid = viewChild(Grid);
  protected readonly reportDate = signal('');

  protected readonly addOpen = signal(false);
  protected readonly selectedLanguage = signal<Language | null>(null);

  readonly #store = listStore(() =>
    this.#languageApi.getAllLanguages().pipe(map((res) => res.languages)),
  );
  protected readonly languages = this.#store.items;

  // Built reactively so headers/labels re-resolve when the language changes.
  protected readonly columns = computed<ColDef<Language>[]>(() => {
    this.#locale.translation();
    const t = (k: string) => this.#translate.instant(k);
    return [
      { field: 'code', headerName: t('languages.code'), width: 110, sortable: true },
      { field: 'name', headerName: t('languages.name'), flex: 2, minWidth: 160, sortable: true },
      { field: 'nativeName', headerName: t('languages.nativeName'), flex: 2, minWidth: 160, sortable: true },
      {
        field: 'enabled',
        headerName: t('languages.enabled'),
        width: 120,
        sortable: true,
        valueFormatter: (p) => t(p.value ? 'common.yes' : 'common.no'),
      },
      { field: 'sortOrder', headerName: t('languages.order'), width: 100, sortable: true },
    ];
  });

  protected readonly gridActions = computed<GridAction[]>(() => {
    this.#locale.translation();
    const t = (k: string) => this.#translate.instant(k);
    return [
      { id: 'toggle', label: t('common.enableDisable'), icon: 'bi-toggle2-on', permission: 'org:settings:manage' },
      { id: 'edit', label: t('common.edit'), icon: 'bi-pencil', styleClass: 'grid-action--edit', permission: 'org:settings:manage' },
      { id: 'delete', label: t('common.delete'), icon: 'bi-trash3', styleClass: 'grid-action--danger', permission: 'org:settings:manage' },
    ];
  });

  protected onGridAction({ id, row }: GridActionEvent<Language>): void {
    if (id === 'toggle') {
      this.#store.mutate(
        this.#languageApi.updateLanguage(row.code, { enabled: !row.enabled }),
        () => this.#locale.loadAvailable(),
      );
    } else if (id === 'edit') {
      this.openLanguage(row);
    } else if (id === 'delete') {
      void this.remove(row);
    }
  }

  protected openLanguage(language: Language | null): void {
    this.selectedLanguage.set(language);
    this.addOpen.set(true);
  }

  protected closeLanguage(refresh: boolean): void {
    this.addOpen.set(false);
    if (refresh) this.languages.reload();
  }

  async remove(language: Language): Promise<void> {
    const ok = await this.#confirm.confirm({
      title: 'Remove language',
      message: `Remove ${language.name} (${language.code})? Any option-label translations for it are deleted too.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    this.#store.mutate(this.#languageApi.deleteLanguage(language.code), () =>
      this.#locale.loadAvailable(),
    );
  }

  print(): void {
    this.reportDate.set(new Date().toLocaleString());
    setTimeout(() => window.print(), 0);
  }

  exportCsv(): void {
    this.grid()?.exportCsv('languages.csv');
  }
}
