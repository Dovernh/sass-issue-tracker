import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { runMigrations, db } from './db/index.js';
import { users } from './db/schema.js';
import { hashPassword } from './hash.js';
import { newUserId } from './ids.js';
import { PERMS } from './permissions.js';

/**
 * End-to-end coverage for self-owned auth. Drives the real Express app over HTTP;
 * requireAuth resolves to localAuth.
 *
 * There is no public sign-up: a platform owner (seeded directly here) provisions
 * orgs + their first admin via /api/platform, and admins provision members via
 * /api/members. These tests bootstrap through that plane.
 */

let server: Server;
let base: string;

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
    body = text; // non-JSON (e.g. Express's default HTML 404)
  }
  return { status: res.status, body };
}

/** Insert a platform owner (no org membership) directly — there's no sign-up. */
async function seedPlatformOwner(email: string, password: string) {
  await db.insert(users).values({
    id: newUserId(),
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    platformRole: 'owner',
  });
}

async function login(email: string, password: string): Promise<string> {
  const { body } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return body.token;
}

/** Owner provisions an org + its first admin via the platform plane. */
async function provisionOrg(
  ownerToken: string,
  orgName: string,
  adminEmail: string,
  adminPassword: string,
) {
  return api(
    '/api/platform/orgs',
    {
      method: 'POST',
      body: JSON.stringify({ orgName, adminEmail, adminPassword }),
    },
    ownerToken,
  );
}

beforeAll(async () => {
  await runMigrations();
  server = createApp().listen(0);
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
  await seedPlatformOwner('owner@example.com', 'password123');
});

afterAll(() => {
  server?.close();
});

describe('local auth flow', () => {
  let ownerToken: string;
  let tokenA: string;
  let tokenB: string;

  it('logs the platform owner in (no org context)', async () => {
    const { status, body } = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@example.com', password: 'password123' }),
    });
    expect(status).toBe(200);
    expect(body.token).toBeTypeOf('string');
    expect(body.platformRole).toBe('owner');
    expect(body.orgId).toBeUndefined();
    ownerToken = body.token;
  });

  it('provisions an org + first admin via the platform plane', async () => {
    const { status, body } = await provisionOrg(ownerToken, 'Org A', 'a@example.com', 'password123');
    expect(status).toBe(201);
    expect(body.name).toBe('Org A');
    expect(body.admins[0].email).toBe('a@example.com');
  });

  it('rejects provisioning with a duplicate email', async () => {
    const { status } = await provisionOrg(ownerToken, 'Dupe', 'a@example.com', 'password123');
    expect(status).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    const { status, body } = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@example.com', password: 'password123' }),
    });
    expect(status).toBe(200);
    expect(body.token).toBeTypeOf('string');
    tokenA = body.token;
  });

  it('rejects a wrong password', async () => {
    const { status } = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@example.com', password: 'wrong' }),
    });
    expect(status).toBe(401);
  });

  it('rejects an unknown email with the same 401', async () => {
    const { status } = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'nobody@example.com', password: 'whatever' }),
    });
    expect(status).toBe(401);
  });

  it('has no public register endpoint (404)', async () => {
    const { status } = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'x@example.com', password: 'password123', orgName: 'X' }),
    });
    expect(status).toBe(404);
  });

  it('returns identity from /api/me with a valid token', async () => {
    const { status, body } = await api('/api/me', undefined, tokenA);
    expect(status).toBe(200);
    expect(body.userId).toMatch(/^user_/);
    expect(body.orgId).toMatch(/^org_/);
    expect(body.orgPermissions).toContain(PERMS.create);
  });

  it('rejects /api/me without a token', async () => {
    const { status } = await api('/api/me');
    expect(status).toBe(401);
  });

  it('updates the avatar via PUT /api/me/avatar', async () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const ok = await api(
      '/api/me/avatar',
      { method: 'PUT', body: JSON.stringify({ imageUrl: dataUrl }) },
      tokenA,
    );
    expect(ok.status).toBe(200);
    expect(ok.body.imageUrl).toBe(dataUrl);

    const bad = await api(
      '/api/me/avatar',
      { method: 'PUT', body: JSON.stringify({ imageUrl: 'not-an-image' }) },
      tokenA,
    );
    expect(bad.status).toBe(400);
  });

  it('denies cross-org access to issues', async () => {
    // Admin A creates an issue in org A.
    const created = await api(
      '/api/issues',
      { method: 'POST', body: JSON.stringify({ description: 'A-only issue' }) },
      tokenA,
    );
    expect(created.status).toBe(201);

    // A second org (B) is provisioned; its admin must not see org A's issue.
    await provisionOrg(ownerToken, 'Org B', 'b@example.com', 'password123');
    tokenB = await login('b@example.com', 'password123');

    const listB = await api('/api/issues', undefined, tokenB);
    expect(listB.status).toBe(200);
    expect(listB.body.issues).toEqual([]);

    const listA = await api('/api/issues', undefined, tokenA);
    expect(
      listA.body.issues.some((i: { description: string }) => i.description === 'A-only issue'),
    ).toBe(true);
  });

  it('enforces permission guards (viewer cannot create)', async () => {
    // Admin A adds a viewer member; the viewer can read but not create.
    const add = await api(
      '/api/members',
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'viewer@example.com',
          password: 'password123',
          role: 'viewer',
        }),
      },
      tokenA,
    );
    expect(add.status).toBe(201);

    const viewerToken = await login('viewer@example.com', 'password123');

    const canList = await api('/api/issues', undefined, viewerToken);
    expect(canList.status).toBe(200);

    const cannotCreate = await api(
      '/api/issues',
      { method: 'POST', body: JSON.stringify({ description: 'nope' }) },
      viewerToken,
    );
    expect(cannotCreate.status).toBe(403);
  });
});
