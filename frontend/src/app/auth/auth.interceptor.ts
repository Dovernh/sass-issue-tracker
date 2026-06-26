import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Attaches the self-issued session JWT as `Authorization: Bearer <token>` on
 * requests to our backend (`environment.apiUrl`). Other requests pass through
 * untouched so we never leak the token to third parties.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const token = inject(AuthService).tokenValue;
  return next(
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req,
  );
};
