import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { runMigrations } from './db/index.js';
import { registerOwner } from './auth.repo.js';
import { hashPassword } from './hash.js';

let server: Server;
let base: string;
let token: string;

beforeAll(async () => {
  await runMigrations();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // Languages are tenant-scoped + seeded on org creation, so we need an org.
  // The owner of a freshly-registered org is an admin (has org:settings:manage).
  await registerOwner({
    email: 'lang@user.com',
    passwordHash: await hashPassword('password123'),
    orgName: 'Lang Org',
  });
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'lang@user.com', password: 'password123' }),
  });
  token = ((await res.json()) as { token: string }).token;
});

afterAll(() => server?.close());

function authed(path: string, init?: RequestInit) {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
}

describe('languages', () => {
  it('requires authentication', async () => {
    const res = await fetch(`${base}/api/languages`);
    expect(res.status).toBe(401);
  });

  it("lists the org's seeded languages", async () => {
    const res = await authed('/api/languages');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { languages: { code: string; nativeName: string }[] };
    expect(body.languages.map((l) => l.code)).toEqual(['en', 'es', 'uk']);
    expect(body.languages.find((l) => l.code === 'es')?.nativeName).toBe('Español');
  });

  it('disables a language and drops it from the enabled list', async () => {
    const patch = await authed('/api/languages/uk', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(patch.status).toBe(200);
    expect(((await patch.json()) as { enabled: boolean }).enabled).toBe(false);

    // The enabled list (switcher) now omits it...
    const enabled = (await (await authed('/api/languages')).json()) as {
      languages: { code: string }[];
    };
    expect(enabled.languages.map((l) => l.code)).toEqual(['en', 'es']);

    // ...but the admin list still shows it (so it can be re-enabled).
    const all = (await (await authed('/api/languages/all')).json()) as {
      languages: { code: string }[];
    };
    expect(all.languages.map((l) => l.code)).toEqual(['en', 'es', 'uk']);
  });

  it('404s patching an unknown language', async () => {
    const res = await authed('/api/languages/zz', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(404);
  });

  it('adds a new language, rejects a duplicate, then removes it', async () => {
    const created = await authed('/api/languages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'fr', name: 'French', nativeName: 'Français', sortOrder: 3 }),
    });
    expect(created.status).toBe(201);
    expect(((await created.json()) as { code: string }).code).toBe('fr');

    // Shows up in the org's enabled list.
    const list = (await (await authed('/api/languages')).json()) as { languages: { code: string }[] };
    expect(list.languages.map((l) => l.code)).toContain('fr');

    // Duplicate code is rejected.
    const dup = await authed('/api/languages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'fr', name: 'French', nativeName: 'Français' }),
    });
    expect(dup.status).toBe(409);

    // Remove it.
    const del = await authed('/api/languages/fr', { method: 'DELETE' });
    expect(del.status).toBe(204);
    const after = (await (await authed('/api/languages')).json()) as { languages: { code: string }[] };
    expect(after.languages.map((l) => l.code)).not.toContain('fr');
  });
});
