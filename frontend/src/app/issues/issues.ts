import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { ColDef } from 'ag-grid-community';
import { map } from 'rxjs';

import { listStore } from '../api/list-store';
import { IssueService } from '../api/proxies/issue/issue.service';
import { type Issue, type IssueStatus } from '../api/proxies/issueTrackerAPI.schemas';
import { LanguageService } from '../core/language.service';
import { OptionLabelsService } from '../core/option-labels.service';
import { ConfirmService } from '../shared/components/confirm/confirm.service';
import { Grid, type GridAction, type GridActionEvent } from '../shared/components/grid/grid';
import { Modal } from '../shared/components/modal/modal';
import { Permissions } from '../shared/directives/permissions';
import { FORM_IMPORTS } from '../shared/form-imports';
import { CreateEditIssue } from './create-edit-issue/create-edit-issue';

type IssueRow = Issue & {
  priorityLabel: string;
  categoryLabel: string;
  descriptionText: string;
};

@Component({
  selector: 'app-issues',
  imports: [...FORM_IMPORTS, CreateEditIssue, Modal, Grid, Permissions],
  templateUrl: './issues.html',
  styleUrl: './issues.scss',
})
export class Issues {
  readonly #issueService = inject(IssueService);
  readonly #optionLabels = inject(OptionLabelsService);
  readonly #confirm = inject(ConfirmService);
  readonly #translate = inject(TranslateService);
  readonly #locale = inject(LanguageService);
  readonly #document = inject(DOCUMENT);

  protected readonly addOpen = signal(false);
  protected readonly reportDate = signal('');
  protected readonly selectedIssue = signal<Issue | null>(null);

  readonly #store = listStore(() =>
    this.#issueService.getIssues().pipe(map((res) => res.issues)),
  );
  protected readonly issues = this.#store.items;

  protected readonly rows = computed<IssueRow[]>(() =>
    this.issues.value().map((i) => ({
      ...i,
      priorityLabel: this.#optionLabels.label('priority', i.priority),
      categoryLabel: this.#optionLabels.label('category', i.category),
      // Descriptions are stored as rich-text HTML; the list and print views
      // show a plain-text preview (the full markup is in the edit dialog).
      descriptionText: this.#htmlToText(i.description ?? ''),
    })),
  );

  /** Strip HTML to plain text via an inert document (no scripts/resources run). */
  #htmlToText(html: string): string {
    const doc = this.#document.implementation.createHTMLDocument('');
    doc.body.innerHTML = html;
    return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  private readonly grid = viewChild(Grid);

  protected exportCsv(): void {
    this.grid()?.exportCsv('issues.csv');
  }

  protected print(): void {
    this.reportDate.set(new Date().toLocaleString());
    // Let the report block render with the new timestamp before printing.
    setTimeout(() => window.print(), 0);
  }

  // Built reactively so headers/labels re-resolve when the language changes.
  protected readonly issueColumns = computed<ColDef<IssueRow>[]>(() => {
    this.#locale.translation();
    const t = (k: string) => this.#translate.instant(k);
    // Description is the only flexing column: it absorbs slack on wide screens.
    // Every other column is fixed-width, so when the viewport gets too narrow
    // the grid overflows and scrolls horizontally instead of squeezing columns
    // (and the actions) out of view.
    return [
      { field: 'id', headerName: t('issues.id'), width: 70, sortable: true },
      { field: 'descriptionText', headerName: t('issues.description'), flex: 1, minWidth: 260, sortable: true, tooltipField: 'descriptionText' },
      { field: 'priorityLabel', headerName: t('issues.priority'), width: 120, sortable: true },
      { field: 'categoryLabel', headerName: t('issues.category'), width: 150, sortable: true },
      { field: 'status', headerName: t('issues.status'), width: 110, sortable: true },
      { field: 'assignedUserName', headerName: t('issues.assignee'), width: 150, sortable: true },
      {
        field: 'createdAt',
        headerName: t('common.created'),
        width: 120,
        sortable: true,
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString() : ''),
      },
    ];
  });

  protected readonly gridActions = computed<GridAction[]>(() => {
    this.#locale.translation();
    const t = (k: string) => this.#translate.instant(k);
    return [
      { id: 'delete', label: t('common.delete'), icon: 'bi-trash3', styleClass: 'grid-action--danger', permission: 'org:tasks:delete' },
      { id: 'edit', label: t('common.edit'), icon: 'bi-pencil', styleClass: 'grid-action--edit', permission: 'org:tasks:edit' },
    ];
  });

  protected onGridAction({ id, row }: GridActionEvent<IssueRow>): void {
    if (id === 'delete') {
      void this.remove(row);
    } else if (id === 'edit') {
      this.openIssue(row);
    }
  }

  protected changeStatus(issue: Issue, event: Event): void {
    const status = (event.target as HTMLSelectElement).value as IssueStatus;
    this.#store.mutate(this.#issueService.updateIssue(issue.id, { status }));
  }

  protected openIssue(issue: Issue | null): void {
    this.selectedIssue.set(issue);
    this.addOpen.set(true);
  }

  protected closeIssue(refresh: boolean): void {
    this.addOpen.set(false);

    if (refresh) {
      this.issues.reload();
    }
  }

  private async remove(issue: Issue): Promise<void> {
    const ok = await this.#confirm.confirm({
      title: this.#translate.instant('issues.deleteTitle'),
      message: this.#translate.instant('issues.deleteMessage', { id: issue.id }),
      confirmText: this.#translate.instant('common.delete'),
      cancelText: this.#translate.instant('common.cancel'),
      danger: true,
    });
    if (!ok) return;
    this.#store.mutate(this.#issueService.deleteIssue(issue.id));
  }
}
