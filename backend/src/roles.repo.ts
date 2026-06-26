import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { organizations } from './db/schema.js';
import {
  DEFAULT_MEMBER_PERMISSIONS,
  MEMBER_TEMPLATE_PERMISSIONS,
  sanitizeMemberTemplate,
} from './permissions.js';

/**
 * The org's editable `member` role permission template. admin/viewer are fixed
 * in code (see permissions.ts); only the member role is customizable per org.
 * Stored on organizations.member_permissions; NULL means "use the default set".
 */

/** The org's current member-role permissions (falls back to the default). */
export async function getMemberPermissions(orgId: string): Promise<string[]> {
  const rows = await db
    .select({ mp: organizations.memberPermissions })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return rows[0]?.mp ?? [...DEFAULT_MEMBER_PERMISSIONS];
}

/** Persist the member-role template (sanitized to grantable perms). Returns it. */
export async function setMemberPermissions(
  orgId: string,
  permissions: string[],
): Promise<string[]> {
  const clean = sanitizeMemberTemplate(permissions);
  await db
    .update(organizations)
    .set({ memberPermissions: clean })
    .where(eq(organizations.id, orgId));
  return clean;
}

/** The full set of permissions an admin may toggle for the member role. */
export function grantableMemberPermissions(): string[] {
  return [...MEMBER_TEMPLATE_PERMISSIONS];
}
