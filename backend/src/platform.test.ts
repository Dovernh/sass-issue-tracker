import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { runMigrations, db } from './db/index.js';
import { memberships, users } from './db/schema.js';
import { hashPassword } from './hash.js';
import { newUserId } from './ids.js';
import { permissionsForRole } from './permissions.js';

/**
 * Platform plane (SaaS control plane) coverage: the platform owner provisions
 * and manages orgs but can never read tenant data, the platform routes reject
 * non-owners, org disable/delete revokes access immediately, and the org
 * switcher only lets a user into orgs they belong to.
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

/** Provision an org + first admin; return { orgId, adminToken }. */
async function provisionOrg(orgName: string, adminEmail: string) {
  const { body } = await api(
    '/api/platform/orgs',
    {
      method: 'POST',
      body: JSON.stringify({ orgName, adminEmail, adminPassword: 'password123' }),
    },
    ownerToken,
  );
  return { orgId: body.id as string, adminToken: await login(adminEmail) };
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

describe('platform owner ↔ tenant isolation', () => {
  it('the owner cannot read tenant issues or members', async () => {
    const issues = await api('/api/issues', undefined, ownerToken);
    expect(issues.status).toBe(403);
    const members = await api('/api/members', undefined, ownerToken);
    expect(members.status).toBe(403);
  });

  it('a non-owner (org admin) cannot reach the platform plane', async () => {
    const { adminToken } = await provisionOrg('Iso Org', 'iso@a.com');
    const list = await api('/api/platform/orgs', undefined, adminToken);
    expect(list.status).toBe(403);
    const create = await api(
      '/api/platform/orgs',
      { method: 'POST', body: JSON.stringify({ orgName: 'X', adminEmail: 'x@x.com', adminPassword: 'password123' }) },
      adminToken,
    );
    expect(create.status).toBe(403);
  });
});

describe('org lifecycle', () => {
  it('owner creates, renames, disables, and deletes an org', async () => {
    const { orgId, adminToken } = await provisionOrg('Life Org', 'life@a.com');

    // It appears in the owner's org list (metadata + admins, no issues).
    const list = await api('/api/platform/orgs', undefined, ownerToken);
    const summary = list.body.orgs.find((o: { id: string }) => o.id === orgId);
    expect(summary.memberCount).toBe(1);
    expect(summary.admins[0].email).toBe('life@a.com');
    expect(summary).not.toHaveProperty('issues');

    // Rename.
    const renamed = await api(
      `/api/platform/orgs/${orgId}`,
      { method: 'PATCH', body: JSON.stringify({ name: 'Life Org 2' }) },
      ownerToken,
    );
    expect(renamed.body.name).toBe('Life Org 2');

    // The admin works before disabling.
    expect((await api('/api/issues', undefined, adminToken)).status).toBe(200);

    // Disable → the org's admin is blocked on the next request (even with a valid token).
    const disabled = await api(
      `/api/platform/orgs/${orgId}`,
      { method: 'PATCH', body: JSON.stringify({ status: 'disabled' }) },
      ownerToken,
    );
    expect(disabled.body.status).toBe('disabled');
    expect((await api('/api/issues', undefined, adminToken)).status).toBe(403);

    // Re-enable, then soft-delete → blocked again.
    await api(`/api/platform/orgs/${orgId}`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) }, ownerToken);
    expect((await api('/api/issues', undefined, adminToken)).status).toBe(200);

    const del = await api(`/api/platform/orgs/${orgId}`, { method: 'DELETE' }, ownerToken);
    expect(del.status).toBe(204);
    expect((await api('/api/issues', undefined, adminToken)).status).toBe(403);

    // A deleted org no longer appears in the owner's list.
    const after = await api('/api/platform/orgs', undefined, ownerToken);
    expect(after.body.orgs.some((o: { id: string }) => o.id === orgId)).toBe(false);
  });

  it('owner adds and removes an org admin (last-admin guarded)', async () => {
    const { orgId } = await provisionOrg('Admins Org', 'first@a.com');

    const second = await api(
      `/api/platform/orgs/${orgId}/admins`,
      { method: 'POST', body: JSON.stringify({ email: 'second@a.com', password: 'password123' }) },
      ownerToken,
    );
    expect(second.status).toBe(201);
    expect(second.body.role).toBe('admin');

    // Remove the second admin → 204, leaving one.
    const removed = await api(
      `/api/platform/orgs/${orgId}/admins/${second.body.userId}`,
      { method: 'DELETE' },
      ownerToken,
    );
    expect(removed.status).toBe(204);

    // Removing the last remaining admin → 409.
    const list = await api('/api/platform/orgs', undefined, ownerToken);
    const org = list.body.orgs.find((o: { id: string }) => o.id === orgId);
    const lastAdmin = org.admins[0];
    const blocked = await api(
      `/api/platform/orgs/${orgId}/admins/${lastAdmin.userId}`,
      { method: 'DELETE' },
      ownerToken,
    );
    expect(blocked.status).toBe(409);
  });
});

describe('org switching', () => {
  it('lists only the caller’s orgs and switches between them', async () => {
    // A user who belongs to two orgs (second membership added directly — there's
    // no endpoint to add an existing user to another org).
    const { orgId: orgX, adminToken } = await provisionOrg('Switch X', 'multi@x.com');
    const me = await api('/api/me', undefined, adminToken);
    const userId = me.body.userId as string;

    const { orgId: orgY } = await provisionOrg('Switch Y', 'yadmin@y.com');
    await db.insert(memberships).values({
      userId,
      orgId: orgY,
      role: 'member',
      permissions: permissionsForRole('member'),
    });

    // Re-login now that the user has two memberships.
    const token = await login('multi@x.com');
    const orgs = await api('/api/me/orgs', undefined, token);
    expect(orgs.status).toBe(200);
    const ids = orgs.body.orgs.map((o: { id: string }) => o.id);
    expect(ids).toContain(orgX);
    expect(ids).toContain(orgY);
    expect(ids).toHaveLength(2);

    // Switch into org Y → token scoped to Y with the member role.
    const switched = await api(
      '/api/auth/switch-org',
      { method: 'POST', body: JSON.stringify({ orgId: orgY }) },
      token,
    );
    expect(switched.status).toBe(200);
    expect(switched.body.orgId).toBe(orgY);
    expect(switched.body.orgRole).toBe('member');

    // Switching into an org the user doesn't belong to → 403.
    const { orgId: orgZ } = await provisionOrg('Switch Z', 'zadmin@z.com');
    const denied = await api(
      '/api/auth/switch-org',
      { method: 'POST', body: JSON.stringify({ orgId: orgZ }) },
      token,
    );
    expect(denied.status).toBe(403);
  });
});
