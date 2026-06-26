import { HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../environments/environment';

/**
 * Prefixes the backend base URL onto root-relative `/api/...` requests emitted
 * by the generated proxy clients (orval uses root-relative paths, so without
 * this they'd hit the Angular dev server and fail JSON parsing on index.html).
 *
 * Absolute URLs and non-API paths (e.g. `/i18n` assets) pass through untouched.
 * Must run before `authInterceptor` so the Bearer token attaches to the
 * rewritten absolute URL.
 */
export const baseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith('/api/')) {
    return next(req.clone({ url: environment.apiUrl + req.url }));
  }
  return next(req);
};
