import { and, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { issues, users, type Issue } from './db/schema.js';

/**
 * Data access for issues via Drizzle. Every query is scoped by org_id and
 * excludes soft-deleted rows (deleted_at IS NULL), so tenants never see each
 * other's data and "deleted" rows stay in the table for audit/restore.
 */

export interface CreateIssueInput {
  description: string;
  createdBy: string;
  assignedUser?: string | null;
  priority?: Issue['priority'];
  category?: Issue['category'];
  screenshotPath?: string | null;
}

export type UpdateIssueInput = Partial<
  Pick<
    Issue,
    'description' | 'assignedUser' | 'priority' | 'category' | 'status' | 'screenshotPath'
  >
>;

const live = isNull(issues.deletedAt);
const scoped = (id: number, orgId: string) =>
  and(eq(issues.id, id), eq(issues.orgId, orgId), live);

export function listIssues(
  orgId: string,
): Promise<(Issue & { assignedUserName: string | null })[]> {
  return db
    .select({
      ...getTableColumns(issues),
      assignedUserName: users.name,
    })
    .from(issues)
    .leftJoin(users, eq(issues.assignedUser, users.id))
    .where(and(eq(issues.orgId, orgId), live))
    .orderBy(desc(issues.createdAt));
}

export async function getIssue(id: number, orgId: string): Promise<Issue | null> {
  const [row] = await db.select().from(issues).where(scoped(id, orgId));
  return row ?? null;
}

export async function createIssue(
  orgId: string,
  data: CreateIssueInput,
): Promise<Issue> {
  const [row] = await db
    .insert(issues)
    .values({
      orgId,
      createdBy: data.createdBy,
      description: data.description,
      assignedUser: data.assignedUser ?? null,
      priority: data.priority ?? 'medium',
      category: data.category ?? 'other',
      screenshotPath: data.screenshotPath ?? null,
    })
    .returning();
  return row;
}

/** Updates only the provided fields. Returns the row, or null if not found. */
export async function updateIssue(
  id: number,
  orgId: string,
  data: UpdateIssueInput,
): Promise<Issue | null> {
  const [row] = await db
    .update(issues)
    .set({
      ...(data.description !== undefined && { description: data.description }),
      ...(data.assignedUser !== undefined && { assignedUser: data.assignedUser }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.screenshotPath !== undefined && { screenshotPath: data.screenshotPath }),
      updatedAt: sql`(CURRENT_TIMESTAMP)`,
    })
    .where(scoped(id, orgId))
    .returning();
  return row ?? null;
}

/** Soft delete: stamps deleted_at. Returns true if a live row was deleted. */
export async function softDeleteIssue(id: number, orgId: string): Promise<boolean> {
  const [row] = await db
    .update(issues)
    .set({ deletedAt: sql`(CURRENT_TIMESTAMP)`, updatedAt: sql`(CURRENT_TIMESTAMP)` })
    .where(scoped(id, orgId))
    .returning();
  return !!row;
}
