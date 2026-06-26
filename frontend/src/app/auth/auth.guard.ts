import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Allows activation only when a user is signed in. Otherwise redirects to
 * `/login`, preserving the attempted URL as a `redirectUrl` query param.
 */
export const authGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isSignedIn()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { redirectUrl: state.url },
  });
};
