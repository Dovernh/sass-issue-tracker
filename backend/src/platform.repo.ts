import { and, count, eq, isNull } from 'drizzle-orm';
import { db } from './db/index.js';
import { memberships, organizations, users, type Organization } from './db/schema.js';
import { newOrgId, newUserId } from './ids.js';
import { DEFAULT_MEMBER_PERMISSIONS, permissionsForRole } from './permissions.js';
import { seedPriorities } from './priorities.repo.js';
import { seedCategories } from './categories.repo.js';
import { seedLanguages } from './languages.repo.js';

/**
 * Platform (control plane) data access for the SaaS owner: org lifecycle +
 * admin assignment. Deliberately exposes org metadata and admins only — never
 * issues or full member rosters.
 */

export interface OrgAdmin {
  userId: string;
  email: string;
  name: string | null;
}

export interface OrgSummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  memberCount: number;
  admins: OrgAdmin[];
}

/** All non-deleted orgs with their admins + member counts (owner dashboard). */
export async function listOrgsForPlatform(): Promise<OrgSummary[]> {
  const orgs = await db
    .select()
    .from(organizations)
    .where(isNull(organizations.deletedAt));

  const summaries: OrgSummary[] = [];
  for (const org of orgs) {
    const [{ n: memberCount }] = await db
      .select({ n: count() })
      .from(memberships)
      .where(eq(memberships.orgId, org.id));

    const admins = await db
      .select({ userId: users.id, email: users.email, name: users.name })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(and(eq(memberships.orgId, org.id), eq(memberships.role, 'admin')));

    summaries.push({
      id: org.id,
      name: org.name,
      status: org.status,
      createdAt: org.createdAt,
      memberCount,
      admins,
    });
  }
  return summaries;
}

export interface CreateOrgInput {
  orgName: string;
  adminEmail: string;
  adminName?: string | null;
  adminPasswordHash: string;
}

/** Provision a new org with its first admin + default option lists. */
export async function createOrgWithAdmin(input: CreateOrgInput): Promise<OrgSummary> {
  const orgId = newOrgId();
  const userId = newUserId();

  await db.insert(organizations).values({
    id: orgId,
    name: input.orgName,
    memberPermissions: [...DEFAULT_MEMBER_PERMISSIONS],
  });
  await db.insert(users).values({
    id: userId,
    email: input.adminEmail.toLowerCase(),
    passwordHash: input.adminPasswordHash,
    name: input.adminName ?? null,
  });
  await db.insert(memberships).values({
    userId,
    orgId,
    role: 'admin',
    permissions: permissionsForRole('admin'),
  });
  // Languages first — option_translations FK the org's language list.
  await seedLanguages(orgId);
  await Promise.all([seedPriorities(orgId), seedCategories(orgId)]);

  return {
    id: orgId,
    name: input.orgName,
    status: 'active',
    createdAt: new Date().toISOString(),
    memberCount: 1,
    admins: [{ userId, email: input.adminEmail.toLowerCase(), name: input.adminName ?? null }],
  };
}

/** Rename an org. Returns the row, or undefined if missing/deleted. */
export async function renameOrg(orgId: string, name: string): Promise<Organization | undefined> {
  const rows = await db
    .update(organizations)
    .set({ name })
    .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
    .returning();
  return rows[0];
}

/** Set an org's status (active | disabled). */
export async function setOrgStatus(
  orgId: string,
  status: 'active' | 'disabled',
): Promise<Organization | undefined> {
  const rows = await db
    .update(organizations)
    .set({ status })
    .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
    .returning();
  return rows[0];
}

/** Soft-delete an org (access is revoked immediately; data retained). */
export async function softDeleteOrg(orgId: string): Promise<boolean> {
  const rows = await db
    .update(organizations)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
    .returning();
  return rows.length > 0;
}
