import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * DTOs for the editable `member` role permission template. admin/viewer are
 * fixed in code; only the member role is org-customizable. See src/routes/roles.ts.
 */

export const MemberRoleSchema = z
  .object({
    /** The member role's currently-granted permissions. */
    permissions: z.array(z.string()),
    /** The full set of permissions an admin may toggle for the member role. */
    available: z.array(z.string()),
  })
  .openapi('MemberRole');

export const MemberRolePatchSchema = z
  .object({
    permissions: z.array(z.string()),
  })
  .openapi('MemberRolePatch');

export type MemberRole = z.infer<typeof MemberRoleSchema>;
export type MemberRolePatch = z.infer<typeof MemberRolePatchSchema>;
