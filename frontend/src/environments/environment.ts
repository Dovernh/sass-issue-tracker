export const environment = {
  production: false,
  // Node/Express backend that verifies the session JWT.
  apiUrl: 'http://localhost:8000',
  // Sentry disabled in dev (only enabled in the prod environment).
  sentryDsn: '',
};
