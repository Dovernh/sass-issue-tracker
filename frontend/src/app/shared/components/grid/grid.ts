import { Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ModuleRegistry,
  themeQuartz,
} from 'ag-grid-community';

import { AuthService } from '../../../auth/auth.service';
import { LanguageService } from '../../../core/language.service';
import { ThemeService } from '../../../core/theme.service';
import { ActionsCellRenderer } from './actions-cell-renderer';

ModuleRegistry.registerModules([AllCommunityModule]);

const LIGHT_THEME = themeQuartz.withParams({
  backgroundColor: '#ffffff',
  foregroundColor: '#161a1f',
  headerBackgroundColor: '#eceff5',
  headerTextColor: '#1b2330',
  headerFontWeight: 600,
  headerFontSize: 12,
  borderColor: '#e3e7ee',
  oddRowBackgroundColor: '#f5f7fa',
  rowHoverColor: 'rgba(47, 67, 199, 0.08)',
  accentColor: '#2f43c7',
  browserColorScheme: 'light',
  fontFamily: 'inherit',
});

const DARK_THEME = themeQuartz.withParams({
  backgroundColor: '#181d25',
  foregroundColor: '#e7ebf0',
  headerBackgroundColor: '#10141a',
  headerTextColor: '#f0f3f7',
  headerFontWeight: 600,
  headerFontSize: 12,
  borderColor: '#283039',
  oddRowBackgroundColor: '#12161c',
  rowHoverColor: 'rgba(128, 147, 255, 0.16)',
  accentColor: '#8093ff',
  browserColorScheme: 'dark',
  fontFamily: 'inherit',
});

/** A row action the grid renders as a button. */
export interface GridAction {
  id: string;
  label: string;
  icon?: string;
  styleClass?: string;
  /** Hide this action unless the signed-in user holds this permission. */
  permission?: string;
}

/** Emitted when a user triggers a row action. */
export interface GridActionEvent<T> {
  id: string;
  row: T;
}

/** Emitted when an editable cell is committed. */
export interface GridCellEdit<T> {
  /** The row's data (already mutated with the new value). */
  row: T;
  /** The column's bound field (e.g. 'key', 'labels.en'), or '' if none. */
  field: string;
  colId: string;
  value: unknown;
  /** True for the pinned bottom "add" row, false for an existing row. */
  isNew: boolean;
}

@Component({
  selector: 'app-grid',
  imports: [AgGridAngular],
  templateUrl: './grid.html',
  styleUrl: './grid.scss',
})
export class Grid<T = unknown> {
  readonly #theme = inject(ThemeService);
  readonly #translate = inject(TranslateService);
  readonly #locale = inject(LanguageService);
  readonly #auth = inject(AuthService);

  readonly rowData = input<T[]>([]);
  readonly colDefs = input<ColDef<T>[]>([]);
  readonly actions = input<GridAction[]>([]);
  /** A draft row pinned to the bottom for inline "add"; omit for none. */
  readonly addRow = input<T | null>(null);

  /** Raised when a row action is clicked; the parent performs the work. */
  readonly action = output<GridActionEvent<T>>();
  /** Raised when an editable cell is committed; the parent persists it. */
  readonly cellEdited = output<GridCellEdit<T>>();

  /** The pinned add-row data for AG Grid (single-element array, or none). */
  protected readonly pinnedBottom = computed<T[] | undefined>(() => {
    const row = this.addRow();
    return row ? [row] : undefined;
  });

  /** Grid theme; swaps light/dark in step with the app theme toggle. */
  protected readonly theme = computed(() =>
    this.#theme.theme() === 'dark' ? DARK_THEME : LIGHT_THEME,
  );

  /** Column defs plus an appended actions column when actions are provided. */
  protected readonly columns = computed<ColDef<T>[]>(() => {
    this.#locale.translation(); // re-resolve the actions header on language change
    const cols = [...this.colDefs()];

    // Drop actions the signed-in user lacks the permission for; omit the whole
    // column when none remain. Reactive: re-runs on permission change.
    const actions = this.actions().filter(
      (a) => !a.permission || this.#auth.hasPermission(a.permission),
    );
    if (actions.length) {
      cols.push({
        colId: 'actions',
        headerName: this.#translate.instant('actions.actions'),
        sortable: false,
        filter: false,
        resizable: false,
        // Sized to the action buttons (~44px each) rather than the 200px
        // default, so it doesn't crowd the data columns.
        width: 56 + actions.length * 44,
        cellRenderer: ActionsCellRenderer,
        cellRendererParams: {
          actions,
          onAction: (id: string, row: T) => this.action.emit({ id, row }),
        },
      });
    }
    return cols;
  });

  protected gridApi?: GridApi<T>;

  protected onGridReady(evt: GridReadyEvent<T>): void {
    this.gridApi = evt.api;
  }

  protected onCellValueChanged(evt: CellValueChangedEvent<T>): void {
    this.cellEdited.emit({
      row: evt.data,
      field: evt.colDef.field ?? '',
      colId: evt.column.getColId(),
      value: evt.newValue,
      isNew: evt.node.rowPinned === 'bottom',
    });
  }

  /** Download the grid's rows as CSV, excluding the actions column. */
  exportCsv(fileName = 'export.csv'): void {
    const columnKeys =
      this.gridApi
        ?.getColumns()
        ?.map((c) => c.getColId())
        .filter((id) => id !== 'actions') ?? [];
    this.gridApi?.exportDataAsCsv({ fileName, columnKeys });
  }
}
