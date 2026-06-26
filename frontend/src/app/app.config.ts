import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import * as Sentry from '@sentry/angular';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';
import { AuthService } from './auth/auth.service';
import { InactivityService } from './auth/inactivity.service';
import { baseUrlInterceptor } from './core/base-url.interceptor';
import { errorInterceptor } from './core/error.interceptor';
import { LanguageService } from './core/language.service';
import { ThemeService } from './core/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([errorInterceptor, baseUrlInterceptor, authInterceptor]),
    ),
    provideCharts(withDefaultRegisterables()),
    provideCharts(withDefaultRegisterables()),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
      fallbackLang: 'en',
      lang: 'en',
    }),
    provideAppInitializer(() => {
      inject(ThemeService); // activates the data-theme effect from stored/OS pref
      inject(LanguageService).init(); // restores the saved language
      const inactivity = inject(InactivityService);
      // Start the idle-timeout watcher once auth has settled.
      return inject(AuthService)
        .load()
        .then(() => inactivity.start());
    }),
    // Report uncaught Angular errors to Sentry (no-op when Sentry isn't init'd).
    ...(environment.sentryDsn
      ? [{ provide: ErrorHandler, useValue: Sentry.createErrorHandler() }]
      : []),
  ],
};
