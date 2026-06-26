import { and, asc, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { priorities, type PriorityRow } from './db/schema.js';
import type { Priority } from './schemas/options.schema.js';
import {
  labelsByKey,
  upsertLabels,
  renameKey,
  deleteLabels,
} from './option-translations.repo.js';

/**
 * Data access for the org-configurable issue-priority option list. The row holds
 * identity/order; per-locale labels live in option_translations (kind
 * 'priority'). Reads assemble a Priority with a `labels` map + a `label`
 * fallback (en → first available → key).
 */

const KIND = 'priority' as const;

export interface OptionInput {
  key: string;
  /** Default-language (en) label. */
  label: string;
  /** Per-locale overrides, e.g. { es: 'Baja', uk: 'Низький' }. */
  labels?: Record<string, string>;
  sortOrder?: number;
}

/** Default seed values; `labels` carries the per-locale text from the i18n files. */
export const DEFAULT_PRIORITIES: { key: string; labels: Record<string, string> }[] = [
  { key: 'low', labels: { en: 'Low', es: 'Baja', uk: 'Низький' } },
  { key: 'medium', labels: { en: 'Medium', es: 'Media', uk: 'Середній' } },
  { key: 'high', labels: { en: 'High', es: 'Alta', uk: 'Високий' } },
  { key: 'urgent', labels: { en: 'Urgent', es: 'Urgente', uk: 'Терміновий' } },
];

function assemble(row: PriorityRow, labels: Record<string, string>): Priority {
  return {
    id: row.id,
    orgId: row.orgId,
    key: row.key,
    label: labels.en ?? Object.values(labels)[0] ?? row.key,
    labels,
    sortOrder: row.sortOrder,
  };
}

/** Merge an input's default `label` (as en) with its per-locale overrides. */
function inputLabels(input: Partial<OptionInput>): Record<string, string> {
  return {
    ...(input.label !== undefined ? { en: input.label } : {}),
    ...(input.labels ?? {}),
  };
}

export async function listPriorities(orgId: string): Promise<Priority[]> {
  const rows = await db
    .select()
    .from(priorities)
    .where(eq(priorities.orgId, orgId))
    .orderBy(asc(priorities.sortOrder), asc(priorities.id));
  const byKey = await labelsByKey(orgId, KIND);
  return rows.map((row) => assemble(row, byKey.get(row.key) ?? {}));
}

export async function createPriority(orgId: string, input: OptionInput): Promise<Priority> {
  const [row] = await db
    .insert(priorities)
    .values({ orgId, key: input.key, sortOrder: input.sortOrder ?? 0 })
    .returning();
  const labels = inputLabels(input);
  await upsertLabels(orgId, KIND, input.key, labels);
  return assemble(row, labels);
}

export async function updatePriority(
  id: number,
  orgId: string,
  input: Partial<OptionInput>,
): Promise<Priority | undefined> {
  const [existing] = await db
    .select()
    .from(priorities)
    .where(and(eq(priorities.id, id), eq(priorities.orgId, orgId)));
  if (!existing) return undefined;

  const changes = {
    ...(input.key !== undefined ? { key: input.key } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  };
  let row = existing;
  if (Object.keys(changes).length > 0) {
    [row] = await db
      .update(priorities)
      .set(changes)
      .where(and(eq(priorities.id, id), eq(priorities.orgId, orgId)))
      .returning();
  }

  if (input.key !== undefined && input.key !== existing.key) {
    await renameKey(orgId, KIND, existing.key, input.key);
  }
  await upsertLabels(orgId, KIND, row.key, inputLabels(input));

  const byKey = await labelsByKey(orgId, KIND);
  return assemble(row, byKey.get(row.key) ?? {});
}

export async function deletePriority(id: number, orgId: string): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(priorities)
    .where(and(eq(priorities.id, id), eq(priorities.orgId, orgId)));
  if (!existing) return false;

  await db.delete(priorities).where(and(eq(priorities.id, id), eq(priorities.orgId, orgId)));
  await deleteLabels(orgId, KIND, existing.key);
  return true;
}

/** Whether `value` is one of the org's configured priorities. */
export async function priorityExists(orgId: string, value: string): Promise<boolean> {
  const rows = await db
    .select({ id: priorities.id })
    .from(priorities)
    .where(and(eq(priorities.orgId, orgId), eq(priorities.key, value)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Seed the org's default priority list + labels. Idempotent: no-op if the org
 * already has priorities, so it's safe to call on every new org.
 */
export async function seedPriorities(orgId: string): Promise<void> {
  const existing = await db
    .select({ id: priorities.id })
    .from(priorities)
    .where(eq(priorities.orgId, orgId))
    .limit(1);
  if (existing.length > 0) return;

  await db
    .insert(priorities)
    .values(DEFAULT_PRIORITIES.map((p, i) => ({ orgId, key: p.key, sortOrder: i })));
  for (const p of DEFAULT_PRIORITIES) {
    await upsertLabels(orgId, KIND, p.key, p.labels);
  }
}
