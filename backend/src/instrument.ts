import * as Sentry from '@sentry/node';
import { config } from './config.js';

/**
 * Sentry init. Imported FIRST in index.ts so auto-instrumentation is in place
 * before Express loads. Enabled in production only; local dev stays quiet.
 *
 * sendDefaultPii is left false so request headers/cookies/bodies — which carry
 * the session Bearer token — are NOT sent to Sentry.
 */
export const sentryEnabled = config.NODE_ENV === 'production' && Boolean(config.SENTRY_DSN);

if (sentryEnabled) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    release: config.RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}
