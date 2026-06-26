import 'dotenv/config';

/**
 * Central config. Read env in exactly one place; never hardcode secrets.
 */
export const config = {
  // Secret used to sign/verify self-issued session JWTs (HS256). Required.
  AUTH_SECRET: process.env.AUTH_SECRET ?? '',

  // Origin of the Angular client; used as the authorized party and CORS allow.
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:4200',

  // libsql/SQLite connection. `file:` URLs resolve from the backend cwd;
  // a Turso `libsql://…` URL needs TURSO_AUTH_TOKEN as well.
  DATABASE_URL: process.env.DATABASE_URL ?? 'file:data/issue-tracker.db',
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ?? '',

  // Sentry DSN (public, not a secret). Default is this project's backend DSN;
  // override via env if needed. Error reporting is enabled in production only.
  SENTRY_DSN:
    process.env.SENTRY_DSN ??
    'https://52ce8870a88666f46cdf6a36baa77254@o4509482618388480.ingest.us.sentry.io/4511588300816384',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  RELEASE: process.env.RENDER_GIT_COMMIT ?? 'local',

  PORT: Number(process.env.PORT ?? 8000),
};

if (!config.AUTH_SECRET) {
  console.warn('[config] AUTH_SECRET is empty — token issue/verify will fail.');
}
