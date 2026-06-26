import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { ROLES } from '../permissions.js';

extendZodWithOpenApi(z);

/**
 * Zod DTOs for the members API (org-scoped admin member management).
 * See `src/routes/members.ts`.
 */

// Assignable roles. Responses may also carry the legacy `owner` role, so the
// response `role` is a plain string rather than this stricter enum.
export const RoleSchema = z.enum(ROLES).openapi('Role');

export const MemberSchema = z
  .object({
    userId: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    imageUrl: z.string().nullable(),
    role: z.string(),
    permissions: z.array(z.string()),
    createdAt: z.string(),
  })
  .openapi('Member');

export const MemberListSchema = z.object({ members: z.array(MemberSchema) }).openapi('MemberList');

export const NewMemberSchema = z
  .object({
    email: z.string().email(),
    name: z.string().optional(),
    role: RoleSchema,
    password: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .openapi('NewMember');

export const MemberPatchSchema = z
  .object({
    name: z.string().optional(),
    role: RoleSchema.optional(),
  })
  .openapi('MemberPatch');

export const PasswordResetSchema = z
  .object({ password: z.string().min(8, 'Password must be at least 8 characters') })
  .openapi('PasswordReset');

export type Member = z.infer<typeof MemberSchema>;
export type NewMember = z.infer<typeof NewMemberSchema>;
export type MemberPatch = z.infer<typeof MemberPatchSchema>;
export type PasswordReset = z.infer<typeof PasswordResetSchema>;
