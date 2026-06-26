import {
  Component,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

import { GridAction } from './grid';

/** Params AG Grid passes through from the host column definition. */
type ActionsParams<T> = ICellRendererParams<T> & {
  actions: GridAction[];
  onAction: (id: string, row: T) => void;
};

/**
 * Renders a row's actions as a kebab (⋮) dropdown. The menu is appended to
 * <body> with fixed positioning so it isn't clipped by AG Grid's cell/row
 * overflow. Clicking an item calls back through `onAction`; the Grid host (and
 * ultimately the parent) decides what it does. Menu styles are global
 * (`.grid-actions-menu` in styles.scss) since the menu lives outside this view.
 */
@Component({
  selector: 'app-actions-cell',
  template: `
    <button
      #trigger
      type="button"
      class="grid-kebab"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      aria-label="Row actions"
      (click)="toggle($event)"
    >
      <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
    </button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      height: 100%;
    }
    .grid-kebab {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      margin: 0;
      padding: 0;
      border: none;
      border-radius: 0.375rem;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .grid-kebab:hover {
      background: color-mix(in srgb, var(--app-primary) 14%, transparent);
    }
  `,
})
export class ActionsCellRenderer<T> implements ICellRendererAngularComp, OnDestroy {
  readonly #renderer = inject(Renderer2);
  readonly #zone = inject(NgZone);

  protected readonly open = signal(false);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  #params!: ActionsParams<T>;
  #menu: HTMLElement | null = null;
  #cleanup: (() => void)[] = [];

  agInit(params: ActionsParams<T>): void {
    this.#params = params;
  }

  refresh(params: ActionsParams<T>): boolean {
    this.#params = params;
    return true;
  }

  ngOnDestroy(): void {
    this.#close();
  }

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.open()) this.#close();
    else this.#openMenu();
  }

  #openMenu(): void {
    const btn = this.trigger().nativeElement;
    const rect = btn.getBoundingClientRect();
    const r = this.#renderer;

    const menu = r.createElement('div') as HTMLElement;
    r.addClass(menu, 'grid-actions-menu');
    r.setAttribute(menu, 'role', 'menu');
    r.setStyle(menu, 'top', `${rect.bottom + 4}px`);
    r.setStyle(menu, 'right', `${window.innerWidth - rect.right}px`);

    const items: HTMLElement[] = [];
    for (const action of this.#params.actions) {
      const item = r.createElement('button') as HTMLElement;
      r.setAttribute(item, 'type', 'button');
      r.setAttribute(item, 'role', 'menuitem');
      r.addClass(item, 'grid-actions-menu__item');
      if (action.styleClass) r.addClass(item, action.styleClass);
      if (action.icon) {
        const icon = r.createElement('i');
        r.addClass(icon, 'bi');
        r.addClass(icon, action.icon);
        r.setAttribute(icon, 'aria-hidden', 'true');
        r.appendChild(item, icon);
      }
      const label = r.createElement('span');
      r.setProperty(label, 'textContent', action.label);
      r.appendChild(item, label);
      r.listen(item, 'click', (ev: Event) => {
        ev.stopPropagation();
        this.#params.onAction(action.id, this.#params.data as T);
        this.#close(true);
      });
      r.appendChild(menu, item);
      items.push(item);
    }

    r.appendChild(document.body, menu);
    this.#menu = menu;
    this.open.set(true);
    // Move focus into the menu (WCAG keyboard support).
    items[0]?.focus();

    // Close on outside click, scroll, or resize; keyboard nav inside the menu.
    // Run listeners outside Angular; re-enter only to flip the signal.
    this.#zone.runOutsideAngular(() => {
      const onDocClick = (ev: MouseEvent): void => {
        if (menu.contains(ev.target as Node) || btn.contains(ev.target as Node)) return;
        this.#zone.run(() => this.#close());
      };
      const onDismiss = (): void => this.#zone.run(() => this.#close());
      const onKeydown = (ev: KeyboardEvent): void => {
        const i = items.indexOf(document.activeElement as HTMLElement);
        if (ev.key === 'Escape') {
          ev.preventDefault();
          this.#zone.run(() => this.#close(true));
        } else if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          items[(i + 1) % items.length]?.focus();
        } else if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          items[(i - 1 + items.length) % items.length]?.focus();
        } else if (ev.key === 'Home') {
          ev.preventDefault();
          items[0]?.focus();
        } else if (ev.key === 'End') {
          ev.preventDefault();
          items[items.length - 1]?.focus();
        } else if (ev.key === 'Tab') {
          this.#zone.run(() => this.#close());
        }
      };
      // Defer so the opening click doesn't immediately close it.
      const t = setTimeout(() => document.addEventListener('click', onDocClick), 0);
      menu.addEventListener('keydown', onKeydown);
      window.addEventListener('scroll', onDismiss, true);
      window.addEventListener('resize', onDismiss);
      this.#cleanup.push(
        () => clearTimeout(t),
        () => document.removeEventListener('click', onDocClick),
        () => menu.removeEventListener('keydown', onKeydown),
        () => window.removeEventListener('scroll', onDismiss, true),
        () => window.removeEventListener('resize', onDismiss),
      );
    });
  }

  #close(refocus = false): void {
    if (this.#menu) {
      this.#renderer.removeChild(document.body, this.#menu);
      this.#menu = null;
    }
    for (const fn of this.#cleanup) fn();
    this.#cleanup = [];
    if (this.open()) this.open.set(false);
    // Return focus to the trigger when dismissed via keyboard / selection.
    if (refocus) this.trigger().nativeElement.focus();
  }
}
