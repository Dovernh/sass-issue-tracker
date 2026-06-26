import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

interface JournalEntry {
  when: number;
  tag: string;
}

/**
 * Records every migration in the journal as already-applied without running
 * its SQL. Used to "baseline" a database that already has the schema (e.g. a
 * pre-seeded/restored DB) but is missing the `__drizzle_migrations` bookkeeping
 * rows — which otherwise makes the migrator re-run `0000_init` and fail with
 * "table ... already exists".
 *
 * The hash drizzle stores is the SHA-256 of the raw migration file contents,
 * and the timestamp is the journal entry's `when`, so we reproduce both here.
 */
async function baselineMigrations(): Promise<void> {
  const journalPath = join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: JournalEntry[];
  };

  await client.execute(
    `CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )`,
  );

  for (const entry of journal.entries) {
    const sql = readFileSync(join(migrationsFolder, `${entry.tag}.sql`), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');

    // Skip if this migration is already recorded (idempotent re-runs).
    const existing = await client.execute({
      sql: 'SELECT 1 FROM "__drizzle_migrations" WHERE hash = ? LIMIT 1',
      args: [hash],
    });
    if (existing.rows.length > 0) continue;

    await client.execute({
      sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
      args: [hash, entry.when],
    });
  }
}

/**
 * Applies pending migrations. Reference data (languages, priority/category
 * lists) is tenant-scoped and seeded per org on creation, so there's nothing
 * global to seed here.
 *
 * Guarded so a database that already contains the schema but lacks migration
 * bookkeeping (a pre-seeded or restored DB) is baselined and retried instead of
 * crashing startup with a "table ... already exists" collision.
 */
export async function runMigrations(): Promise<void> {
  try {
    await migrate(db, { migrationsFolder });
  } catch (err) {
    if (!(err instanceof Error) || !/already exists/i.test(err.message)) {
      throw err;
    }
    console.warn(
      'Migration collided with existing schema; baselining migration ' +
        'history and retrying. This is expected on a pre-seeded database.',
    );
    await baselineMigrations();
    await migrate(db, { migrationsFolder });
  }
}
