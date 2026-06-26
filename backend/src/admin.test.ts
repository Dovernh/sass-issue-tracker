import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createApp } from './app.js';
import { runMigrations, db } from './db/index.js';
import { organizations, users } from './db/schema.js';
import { hashPassword } from './hash.js';
import { newUserId } from './ids.js';

/**
 * Admin member management + org-configurable option lists (priority/category),
 * driven over HTTP. Covers permission gating, the admin/member/viewer role
 * rules, cross-org isolation, and default-option seeding on org creation.
 *
 * There's no public sign-up: a seeded platform owner provisions each org + its
 * first admin via /api/platform, and the admin manages members from there.
 */

let server: Server;
let base: string;
let ownerToken: string;

async function api(path: string, init?: RequestInit, token?: string) {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const text = res.status === 204 ? '' : await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function login(email: string, password = 'password123'): Promise<string> {
  const { body } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return body.token;
}

/** Provision an org + its first admin via the platform plane; return the admin's token. */
async function provisionAdmin(orgName: string, adminEmail: string): Promise<string> {
  await api(
    '/api/platform/orgs',
    {
      method: 'POST',
      body: JSON.stringify({ orgName, adminEmail, adminPassword: 'password123' }),
    },
    ownerToken,
  );
  return login(adminEmail);
}

beforeAll(async () => {
  await runMigrations();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await db.insert(users).values({
    id: newUserId(),
    email: 'owner@platform.com',
    passwordHash: await hashPassword('password123'),
    platformRole: 'owner',
  });
  ownerToken = await login('owner@platform.com');
});

afterAll(() => server?.close());

describe('admin: members', () => {
  let adminToken: string;

  it('the org admin has members + settings permissions', async () => {
    adminToken = await provisionAdmin('Org A', 'a@a.com');
    const me = await api('/api/me', undefined, adminToken);
    expect(me.body.orgRole).toBe('admin');
    expect(me.body.orgPermissions).toContain('org:members:manage');
    expect(me.body.orgPermissions).toContain('org:settings:manage');
  });

  it('lists members (starts with the admin)', async () => {
    const { status, body } = await api('/api/members', undefined, adminToken);
    expect(status).toBe(200);
    expect(body.members).toHaveLength(1);
    expect(body.members[0].role).toBe('admin');
  });

  it('creates a member who can then log in', async () => {
    const created = await api(
      '/api/members',
      { method: 'POST', body: JSON.stringify({ email: 'viewer@a.com', name: 'Vee', role: 'viewer', password: 'password123' }) },
      adminToken,
    );
    expect(created.status).toBe(201);
    expect(created.body.role).toBe('viewer');

    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'viewer@a.com', password: 'password123' }),
    });
    expect(login.status).toBe(200);
    expect(login.body.orgPermissions).not.toContain('org:members:view');
  });

  it('denies a viewer access to member management (403)', async () => {
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'viewer@a.com', password: 'password123' }),
    });
    const denied = await api('/api/members', undefined, login.body.token);
    expect(denied.status).toBe(403);
  });

  it('updates a member role (resets permissions to the role default)', async () => {
    const list = await api('/api/members', undefined, adminToken);
    const viewer = list.body.members.find((m: { email: string }) => m.email === 'viewer@a.com');
    const updated = await api(
      `/api/members/${viewer.userId}`,
      { method: 'PATCH', body: JSON.stringify({ role: 'member', name: 'Vee 2' }) },
      adminToken,
    );
    expect(updated.status).toBe(200);
    expect(updated.body.role).toBe('member');
    expect(updated.body.name).toBe('Vee 2');
    expect(updated.body.permissions).toContain('org:tasks:create');
  });

  it('rejects assigning the non-assignable platform role (owner)', async () => {
    const created = await api(
      '/api/members',
      { method: 'POST', body: JSON.stringify({ email: 'x@a.com', role: 'owner', password: 'password123' }) },
      adminToken,
    );
    expect(created.status).toBe(400);
  });

  it('deletes a member (but not yourself)', async () => {
    // Create a member to delete.
    const created = await api(
      '/api/members',
      { method: 'POST', body: JSON.stringify({ email: 'temp@a.com', role: 'member', password: 'password123' }) },
      adminToken,
    );
    const del = await api(`/api/members/${created.body.userId}`, { method: 'DELETE' }, adminToken);
    expect(del.status).toBe(204);

    // The deleted member can no longer sign in (no membership).
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'temp@a.com', password: 'password123' }),
    });
    expect(login.status).toBe(403);

    // The admin cannot delete themselves.
    const me = await api('/api/me', undefined, adminToken);
    const self = await api(`/api/members/${me.body.userId}`, { method: 'DELETE' }, adminToken);
    expect(self.status).toBe(403);
  });

  it('blocks demoting the last admin', async () => {
    const token = await provisionAdmin('Solo Org', 'solo@a.com');
    const me = await api('/api/me', undefined, token);
    const demote = await api(
      `/api/members/${me.body.userId}`,
      { method: 'PATCH', body: JSON.stringify({ role: 'member' }) },
      token,
    );
    expect(demote.status).toBe(409);
  });

  it('isolates members across orgs', async () => {
    const bToken = await provisionAdmin('Org B', 'admin@b.com');
    const list = await api('/api/members', undefined, bToken);
    expect(list.body.members).toHaveLength(1);
    expect(list.body.members[0].email).toBe('admin@b.com');
  });
});

describe('admin: options (priority/category)', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await provisionAdmin('Opts Org', 'admin@opts.com');
  });

  it('seeds default priorities and categories on org creation', async () => {
    const p = await api('/api/priorities', undefined, adminToken);
    const c = await api('/api/categories', undefined, adminToken);
    expect(p.body.priorities.map((i: { key: string }) => i.key)).toEqual([
      'low', 'medium', 'high', 'urgent',
    ]);
    expect(c.body.categories).toHaveLength(6);
    // Seeded options carry per-locale labels migrated from the i18n files.
    const low = p.body.priorities.find((i: { key: string }) => i.key === 'low');
    expect(low.labels).toEqual({ en: 'Low', es: 'Baja', uk: 'Низький' });
  });

  it('creates, updates, and deletes a priority', async () => {
    const created = await api(
      '/api/priorities',
      { method: 'POST', body: JSON.stringify({ key: 'blocker', label: 'Blocker', sortOrder: 9 }) },
      adminToken,
    );
    expect(created.status).toBe(201);
    const id = created.body.id;

    const updated = await api(
      `/api/priorities/${id}`,
      { method: 'PATCH', body: JSON.stringify({ label: 'Blocker!' }) },
      adminToken,
    );
    expect(updated.body.label).toBe('Blocker!');

    const del = await api(`/api/priorities/${id}`, { method: 'DELETE' }, adminToken);
    expect(del.status).toBe(204);
  });

  it('accepts a custom org priority on an issue but rejects an unknown value', async () => {
    // Add a custom priority for this org.
    const created = await api(
      '/api/priorities',
      { method: 'POST', body: JSON.stringify({ key: 'critical', label: 'Critical' }) },
      adminToken,
    );
    expect(created.status).toBe(201);

    // An issue using the org's custom priority is accepted (DB is the source of truth).
    const ok = await api(
      '/api/issues',
      { method: 'POST', body: JSON.stringify({ description: 'meltdown', priority: 'critical' }) },
      adminToken,
    );
    expect(ok.status).toBe(201);
    expect(ok.body.priority).toBe('critical');

    // A value not in the org's list is still rejected.
    const bad = await api(
      '/api/issues',
      { method: 'POST', body: JSON.stringify({ description: 'nope', priority: 'nonexistent' }) },
      adminToken,
    );
    expect(bad.status).toBe(400);
  });

  it('allows editing and deleting any option (all client data, no system rows)', async () => {
    const list = await api('/api/priorities', undefined, adminToken);
    const low = list.body.priorities.find((i: { key: string }) => i.key === 'low');

    const patch = await api(
      `/api/priorities/${low.id}`,
      { method: 'PATCH', body: JSON.stringify({ label: 'Lowest' }) },
      adminToken,
    );
    expect(patch.status).toBe(200);
    expect(patch.body.label).toBe('Lowest');

    const del = await api(`/api/priorities/${low.id}`, { method: 'DELETE' }, adminToken);
    expect(del.status).toBe(204);
  });

  it('denies settings writes without permission', async () => {
    // Seed a viewer in this org.
    await api(
      '/api/members',
      { method: 'POST', body: JSON.stringify({ email: 'viewer@opts.com', role: 'viewer', password: 'password123' }) },
      adminToken,
    );
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'viewer@opts.com', password: 'password123' }),
    });
    const denied = await api(
      '/api/priorities',
      { method: 'POST', body: JSON.stringify({ key: 'x', label: 'X' }) },
      login.body.token,
    );
    expect(denied.status).toBe(403);
  });
});

describe('schema groundwork (Stage A)', () => {
  it('new orgs default to active + not deleted; the admin has no platform role', async () => {
    const token = await provisionAdmin('Schema Org', 'schema@a.com');
    const me = await api('/api/me', undefined, token);

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, me.body.orgId));
    expect(org.status).toBe('active');
    expect(org.deletedAt).toBeNull();

    const [user] = await db.select().from(users).where(eq(users.id, me.body.userId));
    expect(user.platformRole).toBeNull();
  });
});
