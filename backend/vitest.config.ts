import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Tests run against an isolated in-memory SQLite DB (no file on disk).
    // AUTH_SECRET lets the local-auth token utils sign/verify under test.
    env: { DATABASE_URL: ':memory:', AUTH_SECRET: 'test-secret-not-for-production' },
  },
});
