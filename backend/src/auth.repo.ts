import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { db } from './db/index.js';
import {
  memberships,
  organizations,
  users,
  type Membership,
  type Organization,
  type User,
} from './db/schema.js';
import { newOrgId, newUserId } from './ids.js';
import { effectivePermissions, permissionsForRole } from './permissions.js';
import { seedPriorities } from './priorities.repo.js';
import { seedCategories } from './categories.repo.js';
import { seedLanguages } from './languages.repo.js';

/** A member of an org: their identity joined with their role/permissions. */
export interface MemberView {
  userId: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  role: string;
  permissions: string[];
  createdAt: string;
}

/**
 * Data access for self-owned auth. Mirrors the style of issues.repo.ts.
 */

/** Look up a user by their (unique) email. Returns undefined if none. */
export async function findUserByEmail(email: string): Promise<User | undefined> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return rows[0];
}

/** Look up a user by id. Returns undefined if none. */
export async function findUserById(userId: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0];
}

/** Look up an organization by id. Returns undefined if none. */
export async function findOrganization(orgId: string): Promise<Organization | undefined> {
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return rows[0];
}

/** Update a user's avatar URL (stored verbatim; e.g. a data URL). */
export async function updateUserImage(
  userId: string,
  imageUrl: string,
): Promise<User | undefined> {
  const rows = await db
    .update(users)
    .set({ imageUrl })
    .where(eq(users.id, userId))
    .returning();
  return rows[0];
}

/** The membership joining a user to a specific org, or undefined. */
export async function getMembership(
  userId: string,
  orgId: string,
): Promise<Membership | undefined> {
  const rows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
    .limit(1);
  return rows[0];
}

/** All memberships for a user (used to pick a default active org at login). */
export function getMembershipsForUser(userId: string): Promise<Membership[]> {
  return db.select().from(memberships).where(eq(memberships.userId, userId));
}

/** An org the user belongs to, for the switcher (`GET /api/me/orgs`). */
export interface UserOrg {
  id: string;
  name: string;
  role: string;
  status: string;
}

/** Non-deleted orgs the user belongs to, with their role in each. */
export function getOrgsForUser(userId: string): Promise<UserOrg[]> {
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      role: memberships.role,
      status: organizations.status,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(and(eq(memberships.userId, userId), isNull(organizations.deletedAt)))
    .orderBy(asc(organizations.name));
}

export interface RegisterInput {
  email: string;
  passwordHash: string;
  name?: string | null;
  orgName: string;
}

export interface RegisterResult {
  user: User;
  organization: Organization;
  membership: Membership;
}

/**
 * Bootstrap a new tenant: create the user, a fresh organization, and an owner
 * membership granting all permissions. The caller hashes the password first
 * (this layer never sees plaintext).
 */
export async function registerOwner(input: RegisterInput): Promise<RegisterResult> {
  const userId = newUserId();
  const orgId = newOrgId();

  const [user] = await db
    .insert(users)
    .values({
      id: userId,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      name: input.name ?? null,
    })
    .returning();

  const [organization] = await db
    .insert(organizations)
    .values({ id: orgId, name: input.orgName })
    .returning();

  const [membership] = await db
    .insert(memberships)
    .values({
      userId,
      orgId,
      role: 'owner',
      permissions: permissionsForRole('owner'),
    })
    .returning();

  // Give the new org its default languages + priority/category lists. Languages
  // first — option_translations FK the org's language list.
  await seedLanguages(orgId);
  await Promise.all([seedPriorities(orgId), seedCategories(orgId)]);

  return { user, organization, membership };
}

/* ============================================================================
   Member management (admin). All scoped by orgId.
   ========================================================================== */

/** The org's member-role permission template (null when not customized). */
async function orgMemberTemplate(orgId: string): Promise<string[] | null> {
  const rows = await db
    .select({ mp: organizations.memberPermissions })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return rows[0]?.mp ?? null;
}

/** List an org's members (identity + role/effective permissions), oldest first. */
export async function listMembers(orgId: string): Promise<MemberView[]> {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      imageUrl: users.imageUrl,
      role: memberships.role,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.orgId, orgId))
    .orderBy(asc(memberships.createdAt), asc(memberships.id));
  const template = await orgMemberTemplate(orgId);
  return rows.map((r) => ({ ...r, permissions: effectivePermissions(r.role, template) }));
}

/** One member's view (with effective permissions), or undefined if not in the org. */
export async function getMemberView(
  orgId: string,
  userId: string,
): Promise<MemberView | undefined> {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      imageUrl: users.imageUrl,
      role: memberships.role,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)))
    .limit(1);
  if (!rows[0]) return undefined;
  const permissions = effectivePermissions(rows[0].role, await orgMemberTemplate(orgId));
  return { ...rows[0], permissions };
}

export interface CreateMemberInput {
  email: string;
  passwordHash: string;
  name?: string | null;
  role: string;
}

/** Create a user and add them to an existing org with the given role. */
export async function createMember(
  orgId: string,
  input: CreateMemberInput,
): Promise<MemberView> {
  const userId = newUserId();
  await db.insert(users).values({
    id: userId,
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    name: input.name ?? null,
  });
  await db.insert(memberships).values({
    userId,
    orgId,
    role: input.role,
    permissions: permissionsForRole(input.role),
  });
  return (await getMemberView(orgId, userId))!;
}

/**
 * Update a member's name and/or role (role change resets permissions to the
 * role's defaults). Returns the updated view, or undefined if not in the org.
 */
export async function updateMember(
  orgId: string,
  userId: string,
  input: { name?: string | null; role?: string },
): Promise<MemberView | undefined> {
  const membership = await getMembership(userId, orgId);
  if (!membership) return undefined;

  if (input.name !== undefined) {
    await db.update(users).set({ name: input.name }).where(eq(users.id, userId));
  }
  if (input.role !== undefined) {
    await db
      .update(memberships)
      .set({ role: input.role, permissions: permissionsForRole(input.role) })
      .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  }
  return getMemberView(orgId, userId);
}

/** How many org managers (owner/admin) an org has — protects the last admin. */
export async function countOrgManagers(orgId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), inArray(memberships.role, ['owner', 'admin'])));
  return rows[0]?.n ?? 0;
}

/** Remove a member from an org (deletes the membership). False if not a member. */
export async function deleteMember(orgId: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)))
    .returning();
  return rows.length > 0;
}

/** Reset a member's password. Returns false if the user isn't in the org. */
export async function setMemberPassword(
  orgId: string,
  userId: string,
  passwordHash: string,
): Promise<boolean> {
  const membership = await getMembership(userId, orgId);
  if (!membership) return false;
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  return true;
}
