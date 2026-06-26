import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';

/** One row in a menu popup. `run` performs the action; the menu closes after. */
export interface RteMenuItem {
  label: string;
  icon?: string;
  shortcut?: string;
  isActive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  run: () => void;
}

/**
 * A menu button following the WAI-ARIA menu-button pattern: the trigger opens a
 * popup of `menuitem`s, with arrow-key navigation, Escape to close, click/focus
 * outside to dismiss, and focus returned to the trigger on Escape.
 */
@Component({
  selector: 'app-rte-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './rte-menu.scss',
  template: `
    <button
      #trigger
      type="button"
      class="rte-menu__trigger"
      [class.rte-menu__trigger--toolbar]="variant() === 'toolbar'"
      [class.rte-menu__trigger--open]="open()"
      [disabled]="disabled()"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      [attr.title]="title() || null"
      [attr.aria-label]="title() || null"
      (click)="toggle()"
      (keydown.arrowDown)="openMenu(); $event.preventDefault()"
    >
      @if (icon()) {
        <i class="bi {{ icon() }}" aria-hidden="true"></i>
      }
      <span class="rte-menu__trigger-label">{{ label() }}</span>
      <i class="bi bi-caret-down-fill rte-menu__caret" aria-hidden="true"></i>
    </button>

    @if (open()) {
      <div
        class="rte-menu__popup"
        role="menu"
        tabindex="-1"
        [attr.aria-label]="label()"
        (keydown)="onMenuKeydown($event)"
      >
        @for (item of items(); track item.label) {
          @if (item.separatorBefore) {
            <div class="rte-menu__separator" role="separator"></div>
          }
          <button
            #item
            type="button"
            role="menuitem"
            class="rte-menu__item"
            [class.rte-menu__item--active]="item.isActive"
            [disabled]="item.disabled"
            (click)="select(item)"
          >
            <span class="rte-menu__check" aria-hidden="true">
              @if (item.isActive) {
                <i class="bi bi-check2"></i>
              }
            </span>
            @if (item.icon) {
              <i class="bi {{ item.icon }} rte-menu__item-icon" aria-hidden="true"></i>
            }
            <span class="rte-menu__item-label">{{ item.label }}</span>
            @if (item.shortcut) {
              <span class="rte-menu__shortcut">{{ item.shortcut }}</span>
            }
          </button>
        }
      </div>
    }
  `,
  host: {
    class: 'rte-menu',
    '(keydown.escape)': 'close(true)',
    '(focusout)': 'onFocusout($event)',
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
  },
})
export class RteMenu {
  /** Visible trigger text (e.g. "Format", or the current block style). */
  readonly label = input.required<string>();
  /** Optional leading icon class on the trigger. */
  readonly icon = input<string>('');
  /** Tooltip/aria-label when the trigger text alone isn't descriptive. */
  readonly title = input<string>('');
  readonly items = input<RteMenuItem[]>([]);
  readonly disabled = input(false);
  /** 'menubar' = roomy text trigger; 'toolbar' = compact trigger in the button row. */
  readonly variant = input<'menubar' | 'toolbar'>('menubar');

  readonly #document = inject(DOCUMENT);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private readonly triggerEl =
    viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly itemEls =
    viewChildren<ElementRef<HTMLButtonElement>>('item');

  protected readonly open = signal(false);
  #pendingFocus = false;

  constructor() {
    // Focus the first item once the popup has actually rendered after opening.
    effect(() => {
      const items = this.itemEls();
      if (this.open() && this.#pendingFocus && items.length) {
        items[0].nativeElement.focus();
        this.#pendingFocus = false;
      }
    });
  }

  protected toggle(): void {
    if (this.disabled()) return;
    if (this.open()) this.close(false);
    else this.openMenu();
  }

  protected openMenu(): void {
    if (this.disabled()) return;
    this.#pendingFocus = true;
    this.open.set(true);
  }

  protected close(focusTrigger: boolean): void {
    if (!this.open()) return;
    this.open.set(false);
    this.#pendingFocus = false;
    if (focusTrigger) this.triggerEl().nativeElement.focus();
  }

  protected select(item: RteMenuItem): void {
    if (item.disabled) return;
    item.run();
    this.close(false);
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const items = this.itemEls()
      .map((r) => r.nativeElement)
      .filter((b) => !b.disabled);
    if (!items.length) return;

    const current = items.indexOf(
      this.#document.activeElement as HTMLButtonElement,
    );
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
        next = (current + 1) % items.length;
        break;
      case 'ArrowUp':
        next = (current - 1 + items.length) % items.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    items[next].focus();
  }

  protected onFocusout(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.#host.contains(next)) this.open.set(false);
  }

  protected onDocumentPointerDown(event: Event): void {
    if (this.open() && !this.#host.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
