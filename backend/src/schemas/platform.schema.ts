import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Zod DTOs for the platform control plane (SaaS owner: org lifecycle + admin
 * assignment). See `src/routes/platform.ts`. Exposes org metadata and admins
 * only — never issues or full member rosters.
 */

export const OrgAdminSchema = z
  .object({
    userId: z.string(),
    email: z.string(),
    name: z.string().nullable(),
  })
  .openapi('OrgAdmin');

export const OrgSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    createdAt: z.string(),
    memberCount: z.number().int(),
    admins: z.array(OrgAdminSchema),
  })
  .openapi('OrgSummary');

export const OrgListSchema = z.object({ orgs: z.array(OrgSummarySchema) }).openapi('OrgList');

export const NewOrgSchema = z
  .object({
    orgName: z.string().min(1),
    adminEmail: z.string().email(),
    adminName: z.string().optional(),
    adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .openapi('NewOrg');

export const OrgPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    status: z.enum(['active', 'disabled']).optional(),
  })
  .openapi('OrgPatch');

export const NewOrgAdminSchema = z
  .object({
    email: z.string().email(),
    name: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .openapi('NewOrgAdmin');

export type OrgAdmin = z.infer<typeof OrgAdminSchema>;
export type OrgSummary = z.infer<typeof OrgSummarySchema>;
export type NewOrg = z.infer<typeof NewOrgSchema>;
export type OrgPatch = z.infer<typeof OrgPatchSchema>;
export type NewOrgAdmin = z.infer<typeof NewOrgAdminSchema>;
