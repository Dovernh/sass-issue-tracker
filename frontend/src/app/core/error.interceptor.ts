import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from './notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const notify = inject(NotificationService);
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && auth.isSignedIn()) {
        // Session no longer valid (expired or revoked elsewhere). Drop to the
        // signed-out UI with a clear message instead of a raw 401 toast.
        notify.error('Your session has expired. Please sign in again.');
        void auth.signOut();
        return throwError(() => err);
      }

      const detail = (err.error as { detail?: string } | null)?.detail;
      const message =
        detail ??
        (err.status === 0
          ? 'Cannot reach the server. It may be waking up — try again in a moment.'
          : `Request failed (${err.status}).`);
      notify.error(message);
      return throwError(() => err);
    }),
  );
};
