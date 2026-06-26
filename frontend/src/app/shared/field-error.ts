import { Directive, effect, ElementRef, inject, Renderer2 } from '@angular/core';
import { FORM_FIELD } from '@angular/forms/signals';
import { TranslateService } from '@ngx-translate/core';

@Directive({
  // Attaches to native [formField] controls plus our custom rich-text editor;
  // none of these carry the "app" prefix the lint rule expects on the selector.
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'input[formField], textarea[formField], select[formField], app-rich-text-editor[formField]',
})
export class FieldError {
  readonly #formField = inject(FORM_FIELD);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly #renderer = inject(Renderer2);
  readonly #translate = inject(TranslateService);

  readonly #id = `field-error-${Math.random().toString(36).slice(2)}`;
  #errorEl: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const state = this.#formField.state();
      // Validators provide an i18n key (or a plain string); translate it here at
      // render time. instant() returns the input unchanged for non-keys, so
      // plain-string messages keep working.
      const raw = state.touched() && state.invalid() ? (state.errors()[0]?.message ?? '') : '';
      const message = raw ? this.#translate.instant(raw) : '';

      this.#renderer.setAttribute(this.#host, 'aria-invalid', String(!!message));

      if (message) {
        if (!this.#errorEl) {
          this.#errorEl = this.#renderer.createElement('div');
          this.#renderer.setAttribute(this.#errorEl, 'id', this.#id);
          this.#renderer.setAttribute(this.#errorEl, 'role', 'alert');
          this.#renderer.addClass(this.#errorEl, 'field-error');
          this.#renderer.insertBefore(
            this.#renderer.parentNode(this.#host),
            this.#errorEl,
            this.#renderer.nextSibling(this.#host),
          );
          this.#renderer.setAttribute(this.#host, 'aria-describedby', this.#id);
        }
        this.#renderer.setProperty(this.#errorEl, 'textContent', message);
      } else if (this.#errorEl) {
        this.#renderer.removeChild(this.#renderer.parentNode(this.#host), this.#errorEl);
        this.#errorEl = null;
        this.#renderer.removeAttribute(this.#host, 'aria-describedby');
      }
    });
  }
}
