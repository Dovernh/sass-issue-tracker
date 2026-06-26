import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';

import { AuthService } from '../../auth/auth.service';

@Directive({ selector: '[appPermissions]' })
export class Permissions {
  readonly #vcr = inject(ViewContainerRef);
  readonly #tpl = inject(TemplateRef<unknown>);
  readonly #auth = inject(AuthService);

  readonly appPermissions = input.required<string | string[]>();

  #shown = false;

  constructor() {
    effect(() => {
      const required = this.appPermissions();
      const list = Array.isArray(required) ? required : [required];
      const allowed = list.some((p) => this.#auth.hasPermission(p));

      if (allowed && !this.#shown) {
        this.#vcr.createEmbeddedView(this.#tpl);
        this.#shown = true;
      } else if (!allowed && this.#shown) {
        this.#vcr.clear();
        this.#shown = false;
      }
    });
  }
}
