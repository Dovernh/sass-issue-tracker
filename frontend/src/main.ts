import { bootstrapApplication } from '@angular/platform-browser';
import * as Sentry from '@sentry/angular';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

// Initialize Sentry before bootstrap. Enabled only when a DSN is configured
// (prod). sendDefaultPii stays false so the session token isn't sent.
if (environment.sentryDsn) {
  Sentry.init({
    dsn: environment.sentryDsn,
    environment: environment.production ? 'production' : 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
