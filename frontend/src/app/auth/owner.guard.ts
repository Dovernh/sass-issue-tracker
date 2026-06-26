import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Allows activation only for the platform owner (control plane). Non-owners are
 * redirected to the dashboard.
 */
export const ownerGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isPlatformOwner() ? true : router.createUrlTree(['/dashboard']);
};

/**
 * Guards org-scoped routes: the platform owner has no org context, so send them
 * to their control-plane area instead of loading tenant views (which would 403).
 */
export const orgContextGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isPlatformOwner() ? router.createUrlTree(['/owner']) : true;
};
