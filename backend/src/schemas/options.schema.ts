import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * DTOs for the org-configurable option lists. Priorities and categories are
 * structurally identical, but each entity owns its own named schema set so the
 * generated client gets distinct `Priority`/`Category` types (and the next
 * option-style entity is a copy-paste away). `key` is the stored slug; `label`
 * is the resolved default display text; `labels` holds per-locale overrides
 * keyed by language code (resolution: labels[locale] ?? label). All rows are
 * client data — there is no system/immutable flag.
 */

// ── Priority ────────────────────────────────────────────────────────────────
export const PrioritySchema = z
  .object({
    id: z.number().int(),
    orgId: z.string(),
    key: z.string(),
    label: z.string(),
    labels: z.record(z.string()),
    sortOrder: z.number().int(),
  })
  .openapi('Priority');

export const PriorityListSchema = z
  .object({ priorities: z.array(PrioritySchema) })
  .openapi('PriorityList');

export const NewPrioritySchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    labels: z.record(z.string()).optional(),
    sortOrder: z.number().int().optional(),
  })
  .openapi('NewPriority');

export const PriorityPatchSchema = z
  .object({
    key: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    labels: z.record(z.string()).optional(),
    sortOrder: z.number().int().optional(),
  })
  .openapi('PriorityPatch');

// ── Category ────────────────────────────────────────────────────────────────
export const CategorySchema = z
  .object({
    id: z.number().int(),
    orgId: z.string(),
    key: z.string(),
    label: z.string(),
    labels: z.record(z.string()),
    sortOrder: z.number().int(),
  })
  .openapi('Category');

export const CategoryListSchema = z
  .object({ categories: z.array(CategorySchema) })
  .openapi('CategoryList');

export const NewCategorySchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    labels: z.record(z.string()).optional(),
    sortOrder: z.number().int().optional(),
  })
  .openapi('NewCategory');

export const CategoryPatchSchema = z
  .object({
    key: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    labels: z.record(z.string()).optional(),
    sortOrder: z.number().int().optional(),
  })
  .openapi('CategoryPatch');

export type Priority = z.infer<typeof PrioritySchema>;
export type NewPriority = z.infer<typeof NewPrioritySchema>;
export type PriorityPatch = z.infer<typeof PriorityPatchSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type NewCategory = z.infer<typeof NewCategorySchema>;
export type CategoryPatch = z.infer<typeof CategoryPatchSchema>;
