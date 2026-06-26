import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Route guard factory: allows activation only when the active membership has the
 * given permission. Otherwise redirects to `fallback` (default /dashboard). Pair
 * with the template-level `@if (auth.isSignedIn())` gate around the router outlet,
 * which handles the signed-out case. Guarding the dashboard itself must pass a
 * non-dashboard fallback (e.g. /issues) to avoid a redirect loop.
 */
export function permGuard(permission: string, fallback = '/dashboard'): CanActivateFn {
  return (): boolean | UrlTree => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.hasPermission(permission) ? true : router.createUrlTree([fallback]);
  };
}
