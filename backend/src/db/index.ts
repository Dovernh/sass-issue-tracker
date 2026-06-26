import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import * as schema from './schema.js';

// Ensure the directory for a local `file:` database exists.
const fileMatch = config.DATABASE_URL.match(/^file:(.+)$/);
if (fileMatch) {
  mkdirSync(dirname(fileMatch[1]), { recursive: true });
}

const client = createClient({
  url: config.DATABASE_URL,
  // Required for remote Turso (libsql://) URLs; ignored for local file: DBs.
  ...(config.TURSO_AUTH_TOKEN ? { authToken: config.TURSO_AUTH_TOKEN } : {}),
});

export const db = drizzle(client, { schema });

const migrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../drizzle',
);

/**
 * Applies pending migrations. Reference data (languages, priority/category
 * lists) is tenant-scoped and seeded per org on creation, so there's nothing
 * global to seed here.
 */
export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder });
}
