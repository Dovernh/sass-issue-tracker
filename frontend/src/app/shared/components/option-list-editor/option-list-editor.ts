import { Component, computed, input, output, signal } from '@angular/core';

/** A language the option can be translated into. */
export interface EditorLanguage {
  code: string;
  nativeName: string;
}

/** An existing option row. */
export interface EditorOption {
  id: number;
  key: string;
  sortOrder: number;
  labels: Record<string, string>;
}

/** A new option to create. */
export interface OptionDraft {
  key: string;
  sortOrder: number;
  labels: Record<string, string>;
}

/** A partial edit to an existing option. */
export interface OptionPatch {
  key?: string;
  sortOrder?: number;
  labels?: Record<string, string>;
}

/**
 * Master–detail editor for an org option list (priority/category) with per-locale
 * labels. The list stays narrow regardless of language count; the detail panel
 * holds one input per language and scrolls. Edits to an existing option save on
 * blur (`update`); the draft is created on submit (`create`). Presentational —
 * the parent owns the data + persistence and feeds fresh `items` back in.
 */
@Component({
  selector: 'app-option-list-editor',
  templateUrl: './option-list-editor.html',
  styleUrl: './option-list-editor.scss',
})
export class OptionListEditor {
  readonly items = input<EditorOption[]>([]);
  readonly languages = input<EditorLanguage[]>([]);
  /** Locale whose label represents the option in the list (falls back sensibly). */
  readonly defaultLocale = input('en');
  readonly addLabel = input('Add option');
  readonly entityLabel = input('option');
  /** When false, hide the add/create/delete controls and lock the inputs. */
  readonly canManage = input(true);

  readonly create = output<OptionDraft>();
  readonly update = output<{ id: number; patch: OptionPatch }>();
  readonly remove = output<number>();

  protected readonly selectedId = signal<number | null>(null);
  protected readonly adding = signal(false);
  protected readonly draft = signal<OptionDraft>({ key: '', sortOrder: 0, labels: {} });
  protected readonly error = signal('');

  protected readonly selected = computed(
    () => this.items().find((i) => i.id === this.selectedId()) ?? null,
  );

  /** The option currently shown in the detail panel: the draft, or the selection. */
  protected readonly current = computed<EditorOption | OptionDraft | null>(() =>
    this.adding() ? this.draft() : this.selected(),
  );

  /** How many of the org's languages this option has a non-empty label for. */
  protected filled(o: EditorOption | OptionDraft): number {
    return this.languages().filter((l) => o.labels[l.code]?.trim()).length;
  }

  /** The option's representative label (default locale → first available → key). */
  protected resolved(o: EditorOption): string {
    return o.labels[this.defaultLocale()] || Object.values(o.labels).find(Boolean) || '';
  }

  protected completenessLabel(o: EditorOption | OptionDraft): string {
    return `${this.filled(o)} of ${this.languages().length} languages translated`;
  }

  protected select(id: number): void {
    this.adding.set(false);
    this.error.set('');
    this.selectedId.set(id);
  }

  protected startAdd(): void {
    const nextOrder = this.items().reduce((max, i) => Math.max(max, i.sortOrder + 1), 0);
    this.draft.set({ key: '', sortOrder: nextOrder, labels: {} });
    this.error.set('');
    this.selectedId.set(null);
    this.adding.set(true);
  }

  protected cancelAdd(): void {
    this.adding.set(false);
    this.error.set('');
  }

  // ── Edits (save-on-blur for existing; accumulate for the draft) ──────────────
  protected commitKey(value: string): void {
    const key = value.trim();
    if (this.adding()) {
      this.draft.update((d) => ({ ...d, key }));
      return;
    }
    const o = this.selected();
    if (o && key && key !== o.key) this.update.emit({ id: o.id, patch: { key } });
  }

  protected commitOrder(value: string): void {
    const sortOrder = Number(value) || 0;
    if (this.adding()) {
      this.draft.update((d) => ({ ...d, sortOrder }));
      return;
    }
    const o = this.selected();
    if (o && sortOrder !== o.sortOrder) this.update.emit({ id: o.id, patch: { sortOrder } });
  }

  protected commitLabel(code: string, value: string): void {
    if (this.adding()) {
      this.draft.update((d) => ({ ...d, labels: { ...d.labels, [code]: value } }));
      return;
    }
    const o = this.selected();
    if (o && (o.labels[code] ?? '') !== value) {
      this.update.emit({ id: o.id, patch: { labels: { [code]: value } } });
    }
  }

  protected submitDraft(): void {
    const d = this.draft();
    if (!d.key.trim()) {
      this.error.set('A key is required.');
      return;
    }
    const labels = Object.fromEntries(
      Object.entries(d.labels).filter(([, v]) => v?.trim().length),
    );
    if (!Object.keys(labels).length) {
      this.error.set('Add a label for at least one language.');
      return;
    }
    this.create.emit({ key: d.key.trim(), sortOrder: d.sortOrder, labels });
    this.adding.set(false);
    this.error.set('');
  }

  protected removeSelected(): void {
    const o = this.selected();
    if (o) this.remove.emit(o.id);
  }
}
