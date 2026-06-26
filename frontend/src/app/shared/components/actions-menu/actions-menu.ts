import { Component, input, signal } from '@angular/core';

/**
 * A page-level "Actions" dropdown button. Projects its menu items via content
 * projection — pass plain `<button class="grid-actions-menu__item">` items (same
 * styling as the grid row kebab). Opens on click; closes on item click, outside
 * click, or Escape. The trigger carries the menu ARIA; items are buttons, so
 * they're focusable/operable by keyboard.
 *
 * @example
 * <app-actions-menu>
 *   <button type="button" class="grid-actions-menu__item" (click)="exportCsv()">
 *     <i class="bi bi-filetype-csv" aria-hidden="true"></i> Export CSV
 *   </button>
 * </app-actions-menu>
 */
@Component({
  selector: 'app-actions-menu',
  templateUrl: './actions-menu.html',
  styleUrl: './actions-menu.scss',
  // Close on any document click or Escape. The trigger stops propagation so its
  // own clicks never reach here; clicking a projected item bubbles up and closes
  // the menu (after the item's own handler runs), as do outside clicks.
  host: {
    '(document:click)': 'close()',
    '(keydown.escape)': 'close()',
  },
})
export class ActionsMenu {
  /** Trigger button text. */
  readonly label = input('Actions');

  protected readonly open = signal(false);

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open.update((o) => !o);
  }

  protected close(): void {
    if (this.open()) this.open.set(false);
  }
}
