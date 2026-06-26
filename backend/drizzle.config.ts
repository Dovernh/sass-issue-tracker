import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit reads this for `generate` (diff schema -> SQL migrations) and
// `studio`. Migrations are applied at app startup via runMigrations().
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:data/issue-tracker.db',
  },
});
