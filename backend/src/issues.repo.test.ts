import { beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from './db/index.js';
import {
  createIssue,
  getIssue,
  listIssues,
  softDeleteIssue,
  updateIssue,
} from './issues.repo.js';

const ORG_A = 'org_a';
const ORG_B = 'org_b';

beforeAll(async () => {
  await runMigrations();
});

describe('issues.repo', () => {
  it('creates an issue with defaults', async () => {
    const issue = await createIssue(ORG_A, {
      description: 'Login button 500s',
      createdBy: 'user_1',
    });
    expect(issue.id).toBeGreaterThan(0);
    expect(issue.status).toBe('open');
    expect(issue.priority).toBe('medium');
    expect(issue.category).toBe('other');
    expect(issue.assignedUser).toBeNull();
    expect(issue.deletedAt).toBeNull();
  });

  it('scopes lists by org', async () => {
    await createIssue(ORG_B, { description: 'other org', createdBy: 'user_9' });
    const a = await listIssues(ORG_A);
    const b = await listIssues(ORG_B);
    expect(a.every((i) => i.orgId === ORG_A)).toBe(true);
    expect(b.every((i) => i.orgId === ORG_B)).toBe(true);
    expect(a.some((i) => i.orgId === ORG_B)).toBe(false);
  });

  it('updates only provided fields', async () => {
    const created = await createIssue(ORG_A, {
      description: 'needs triage',
      createdBy: 'user_1',
    });
    const updated = await updateIssue(created.id, ORG_A, {
      status: 'in_progress',
      assignedUser: 'user_2',
    });
    expect(updated?.status).toBe('in_progress');
    expect(updated?.assignedUser).toBe('user_2');
    expect(updated?.description).toBe('needs triage'); // untouched
  });

  it('will not update across orgs', async () => {
    const created = await createIssue(ORG_A, {
      description: 'org A only',
      createdBy: 'user_1',
    });
    const result = await updateIssue(created.id, ORG_B, { status: 'closed' });
    expect(result).toBeNull();
  });

  it('soft-deletes and hides from live queries', async () => {
    const created = await createIssue(ORG_A, {
      description: 'to delete',
      createdBy: 'user_1',
    });
    expect(await softDeleteIssue(created.id, ORG_A)).toBe(true);
    expect(await getIssue(created.id, ORG_A)).toBeNull();
    const live = await listIssues(ORG_A);
    expect(live.some((i) => i.id === created.id)).toBe(false);
    // Deleting an already-deleted row reports no change.
    expect(await softDeleteIssue(created.id, ORG_A)).toBe(false);
  });
});
