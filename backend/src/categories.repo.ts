import { and, asc, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { categories, type CategoryRow } from './db/schema.js';
import type { Category } from './schemas/options.schema.js';
import {
  labelsByKey,
  upsertLabels,
  renameKey,
  deleteLabels,
} from './option-translations.repo.js';

/**
 * Data access for the org-configurable issue-category option list. The row holds
 * identity/order; per-locale labels live in option_translations (kind
 * 'category'). Reads assemble a Category with a `labels` map + a `label`
 * fallback (en → first available → key).
 */

const KIND = 'category' as const;

export interface OptionInput {
  key: string;
  /** Default-language (en) label. */
  label: string;
  /** Per-locale overrides, e.g. { es: 'Error', uk: 'Помилка' }. */
  labels?: Record<string, string>;
  sortOrder?: number;
}

/** Default seed values; `labels` carries the per-locale text from the i18n files. */
export const DEFAULT_CATEGORIES: { key: string; labels: Record<string, string> }[] = [
  { key: 'bug', labels: { en: 'Bug', es: 'Error', uk: 'Помилка' } },
  {
    key: 'feature_request',
    labels: { en: 'Feature request', es: 'Solicitud de función', uk: 'Запит на функцію' },
  },
  { key: 'ui_ux', labels: { en: 'UI / UX', es: 'Interfaz / UX', uk: 'Інтерфейс / UX' } },
  { key: 'performance', labels: { en: 'Performance', es: 'Rendimiento', uk: 'Продуктивність' } },
  { key: 'billing', labels: { en: 'Billing', es: 'Facturación', uk: 'Оплата' } },
  { key: 'other', labels: { en: 'Other', es: 'Otro', uk: 'Інше' } },
];

function assemble(row: CategoryRow, labels: Record<string, string>): Category {
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

export async function listCategories(orgId: string): Promise<Category[]> {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.orgId, orgId))
    .orderBy(asc(categories.sortOrder), asc(categories.id));
  const byKey = await labelsByKey(orgId, KIND);
  return rows.map((row) => assemble(row, byKey.get(row.key) ?? {}));
}

export async function createCategory(orgId: string, input: OptionInput): Promise<Category> {
  const [row] = await db
    .insert(categories)
    .values({ orgId, key: input.key, sortOrder: input.sortOrder ?? 0 })
    .returning();
  const labels = inputLabels(input);
  await upsertLabels(orgId, KIND, input.key, labels);
  return assemble(row, labels);
}

export async function updateCategory(
  id: number,
  orgId: string,
  input: Partial<OptionInput>,
): Promise<Category | undefined> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.orgId, orgId)));
  if (!existing) return undefined;

  const changes = {
    ...(input.key !== undefined ? { key: input.key } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  };
  let row = existing;
  if (Object.keys(changes).length > 0) {
    [row] = await db
      .update(categories)
      .set(changes)
      .where(and(eq(categories.id, id), eq(categories.orgId, orgId)))
      .returning();
  }

  if (input.key !== undefined && input.key !== existing.key) {
    await renameKey(orgId, KIND, existing.key, input.key);
  }
  await upsertLabels(orgId, KIND, row.key, inputLabels(input));

  const byKey = await labelsByKey(orgId, KIND);
  return assemble(row, byKey.get(row.key) ?? {});
}

export async function deleteCategory(id: number, orgId: string): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.orgId, orgId)));
  if (!existing) return false;

  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.orgId, orgId)));
  await deleteLabels(orgId, KIND, existing.key);
  return true;
}

/** Whether `value` is one of the org's configured categories. */
export async function categoryExists(orgId: string, value: string): Promise<boolean> {
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.orgId, orgId), eq(categories.key, value)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Seed the org's default category list + labels. Idempotent: no-op if the org
 * already has categories, so it's safe to call on every new org.
 */
export async function seedCategories(orgId: string): Promise<void> {
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.orgId, orgId))
    .limit(1);
  if (existing.length > 0) return;

  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c, i) => ({ orgId, key: c.key, sortOrder: i })));
  for (const c of DEFAULT_CATEGORIES) {
    await upsertLabels(orgId, KIND, c.key, c.labels);
  }
}
