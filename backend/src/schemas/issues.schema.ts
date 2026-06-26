import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { PRIORITIES, STATUSES, CATEGORIES } from '../db/schema.js';

// One-time augmentation so `.openapi(...)` metadata is available on schemas.
extendZodWithOpenApi(z);

/**
 * Zod "DTOs" for the issues API — the single source of truth.
 *
 * Each schema does double duty (like a C# DTO + its validation attributes):
 *  - runtime validation in the route via `.parse()` / `.safeParse()`
 *  - the OpenAPI schema that the Angular client is generated from
 *
 * Derive the static TS type from the schema with `z.infer<>`, never the reverse.
 */

export const PrioritySchema = z.enum(PRIORITIES).openapi('IssuePriority');
export const StatusSchema = z.enum(STATUSES).openapi('IssueStatus');
export const CategorySchema = z.enum(CATEGORIES).openapi('IssueCategory');

/** Full issue row as returned by the API. */
export const IssueSchema = z
  .object({
    id: z.number().int(),
    orgId: z.string(),
    createdBy: z.string(),
    description: z.string(),
    assignedUser: z.string().nullable(),
    // Display-only, joined from users.name by the list endpoint; absent on
    // create/update responses, so optional rather than required.
    assignedUserName: z.string().nullable().optional(),
    priority: PrioritySchema,
    category: CategorySchema,
    status: StatusSchema,
    screenshotPath: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable(),
  })
  .openapi('Issue');

// priority/category on input are plain strings: they're validated at runtime
// against each org's configurable option lists (DB source of truth), not a
// fixed enum — so custom org options are accepted. See issues route.
const OptionValue = z.string().min(1);

/** POST /api/issues body. priority/category are optional (fall back to defaults). */
export const NewIssueSchema = z
  .object({
    description: z.string().min(1, 'Description is required'),
    assignedUser: z.string().optional(),
    priority: OptionValue.optional(),
    category: OptionValue.optional(),
    screenshotPath: z.string().optional(),
  })
  .openapi('NewIssue');

/** PATCH /api/issues/:id body — every field optional. */
export const IssuePatchSchema = z
  .object({
    description: z.string().min(1).optional(),
    assignedUser: z.string().nullable().optional(),
    priority: OptionValue.optional(),
    category: OptionValue.optional(),
    status: StatusSchema.optional(),
    screenshotPath: z.string().nullable().optional(),
  })
  .openapi('IssuePatch');

/** GET /api/issues envelope. */
export const IssueListSchema = z.object({ issues: z.array(IssueSchema) }).openapi('IssueList');

/** Standard error body ({ detail }) emitted by the error handler. */
export const ErrorSchema = z.object({ detail: z.string() }).openapi('Error');

export type Issue = z.infer<typeof IssueSchema>;
export type NewIssue = z.infer<typeof NewIssueSchema>;
export type IssuePatch = z.infer<typeof IssuePatchSchema>;
