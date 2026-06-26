import { and, eq, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { optionTranslations } from './db/schema.js';

/**
 * Per-locale labels for org option lists (priority/category), in one polymorphic
 * table keyed by (orgId, kind, key, languageCode). Shared by priorities.repo and
 * categories.repo — the option tables hold identity/order; text lives here.
 */

export type OptionKind = 'priority' | 'category';

/** All labels for an org's options of a kind, grouped by key → { lang: label }. */
export async function labelsByKey(
  orgId: string,
  kind: OptionKind,
): Promise<Map<string, Record<string, string>>> {
  const rows = await db
    .select()
    .from(optionTranslations)
    .where(and(eq(optionTranslations.orgId, orgId), eq(optionTranslations.kind, kind)));

  const byKey = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const labels = byKey.get(row.key) ?? {};
    labels[row.languageCode] = row.label;
    byKey.set(row.key, labels);
  }
  return byKey;
}

/** Upsert the provided per-locale labels for one option key (leaves others). */
export async function upsertLabels(
  orgId: string,
  kind: OptionKind,
  key: string,
  labels: Record<string, string>,
): Promise<void> {
  const rows = Object.entries(labels)
    .filter(([, label]) => label.trim().length > 0)
    .map(([languageCode, label]) => ({ orgId, kind, key, languageCode, label }));
  if (!rows.length) return;

  await db
    .insert(optionTranslations)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        optionTranslations.orgId,
        optionTranslations.kind,
        optionTranslations.key,
        optionTranslations.languageCode,
      ],
      // `excluded` is the row that would have been inserted (SQLite upsert).
      set: { label: sql`excluded.label` },
    });
}

/** Move all labels from one key to another (when an option's value is renamed). */
export async function renameKey(
  orgId: string,
  kind: OptionKind,
  oldKey: string,
  newKey: string,
): Promise<void> {
  if (oldKey === newKey) return;
  await db
    .update(optionTranslations)
    .set({ key: newKey })
    .where(
      and(
        eq(optionTranslations.orgId, orgId),
        eq(optionTranslations.kind, kind),
        eq(optionTranslations.key, oldKey),
      ),
    );
}

/** Delete all labels for one option key. */
export async function deleteLabels(
  orgId: string,
  kind: OptionKind,
  key: string,
): Promise<void> {
  await db
    .delete(optionTranslations)
    .where(
      and(
        eq(optionTranslations.orgId, orgId),
        eq(optionTranslations.kind, kind),
        eq(optionTranslations.key, key),
      ),
    );
}
