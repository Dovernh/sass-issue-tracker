import { localAuth } from './auth.local.js';

/**
 * Auth entry point used by routes. Self-owned auth is now the only provider, so
 * this is a thin alias for `localAuth`; routes import `requireAuth` to keep the
 * provider an implementation detail.
 */
export const requireAuth = localAuth;
