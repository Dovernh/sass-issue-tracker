import { Component, inject, output, signal } from '@angular/core';
import { email, form, required } from '@angular/forms/signals';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../auth/auth.service';
import { FORM_IMPORTS } from '../shared/form-imports';
import { LoginData } from './loginData';

@Component({
  selector: 'app-login',
  imports: [...FORM_IMPORTS],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  readonly loggedIn = output<void>();
  readonly cancelled = output<void>();
  readonly #auth = inject(AuthService);
  readonly #translate = inject(TranslateService);

  protected readonly showPassword = signal(false);
  protected readonly submitError = signal('');

  #model = signal<LoginData>({
    email: '',
    password: '',
  });

  protected loginForm = form(
    this.#model,
    (s) => {
      required(s.email, { message: 'login.errors.emailRequired' });
      email(s.email, { message: 'login.errors.emailInvalid' });

      required(s.password, { message: 'login.errors.passwordRequired' });
    },
    {
      submission: {
        action: async (f) => {
          this.submitError.set('');
          const { email, password } = f().value();
          try {
            await this.#auth.signInWithPassword(email, password);
            this.loggedIn.emit();
          } catch (err) {
            this.submitError.set(
              err instanceof Error
                ? err.message
                : this.#translate.instant('login.errors.generic'),
            );
          }
        },
      },
    },
  );
}
