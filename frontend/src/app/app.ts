import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from './auth/auth.service';
import { Login } from './login/login';
import { ConfirmDialog } from './shared/components/confirm/confirm-dialog';
import { Modal } from './shared/components/modal/modal';
import { Navbar } from './shared/components/navbar/navbar';
import { Toast } from './shared/toast';

@Component({
  selector: 'app-root',
  imports: [Navbar, Modal, Toast, Login, ConfirmDialog, RouterOutlet, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);
  readonly #router = inject(Router);
  protected readonly loginOpen = signal(false);

  /**
   * After sign-in the router outlet becomes visible, but the route was already
   * activated (guards ran) while signed out — so navigate explicitly to re-run
   * guards and land on the right home: the owner's control plane or the org
   * dashboard.
   */
  protected async onLoggedIn(): Promise<void> {
    this.loginOpen.set(false);
    await this.#router.navigateByUrl(this.auth.isPlatformOwner() ? '/owner' : '/dashboard');
  }
}
