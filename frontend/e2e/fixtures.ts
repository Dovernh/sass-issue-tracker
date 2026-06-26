import AxeBuilder from '@axe-core/playwright';
import { expect, Page } from '@playwright/test';

/**
 * Shared e2e infrastructure: a mocked backend (Playwright route interception)
 * plus a seeded auth session, so specs run against the real Angular app with no
 * server. Specs tune the session via `MockOptions` (role, permissions, data).
 */

export const PERMS_ADMIN = [
  'org:dashboard:view',
  'org:tasks:create',
  'org:tasks:edit',
  'org:tasks:delete',
  'org:members:view',
  'org:members:manage',
];

/** A regular member: can see the dashboard and create/edit issues, but not
 * delete them and not reach the admin area (no members:view). */
export const PERMS_MEMBER = ['org:dashboard:view', 'org:tasks:create', 'org:tasks:edit'];

/** A member with no org permissions: can view lists but not mutate. */
export const PERMS_VIEWER: string[] = [];

export const USER = { id: 'u1', email: 'paul@example.com', name: 'Paul H', imageUrl: null };

export const ISSUE = {
  id: 6,
  orgId: 'org1',
  createdBy: 'u1',
  description: '<p><strong>Reference</strong> site about Lorem Ipsum.</p>',
  assignedUser: 'u1',
  assignedUserName: 'Paul H',
  priority: 'high',
  category: 'feature',
  status: 'open',
  screenshotPath: null,
  createdAt: '2026-06-21T00:00:00.000Z',
  updatedAt: '2026-06-21T00:00:00.000Z',
  deletedAt: null,
};

export const MEMBER = {
  userId: 'u1',
  email: 'paul@example.com',
  name: 'Paul H',
  imageUrl: null,
  role: 'admin',
  permissions: PERMS_ADMIN,
  createdAt: ISSUE.createdAt,
};

const PRIORITY = { id: 1, orgId: 'org1', key: 'high', label: 'High', labels: { en: 'High' }, sortOrder: 1 };
const CATEGORY = {
  id: 1,
  orgId: 'org1',
  key: 'feature',
  label: 'Feature request',
  labels: { en: 'Feature request' },
  sortOrder: 1,
};

export interface MockOptions {
  permissions?: string[];
  role?: string;
  platformRole?: string | null;
  issues?: typeof ISSUE[];
}

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/** Intercept every backend call the signed-in app makes on the main routes. */
export async function mockBackend(page: Page, opts: MockOptions = {}): Promise<void> {
  const permissions = opts.permissions ?? PERMS_ADMIN;
  const role = opts.role ?? 'admin';
  const platformRole = opts.platformRole ?? null;
  const issues = opts.issues ?? [ISSUE];

  // Catch-all first; specific handlers registered after it take precedence.
  await page.route('**/api/**', (route) => route.fulfill(json({})));

  await page.route('**/api/auth/login', (route) =>
    route.fulfill(
      json({ token: 'e2e-token', user: USER, orgId: 'org1', orgRole: role, orgPermissions: permissions, platformRole }),
    ),
  );

  await page.route('**/api/me', (route) =>
    route.fulfill(
      json({ userId: USER.id, orgId: 'org1', orgRole: role, orgPermissions: permissions, platformRole }),
    ),
  );
  await page.route('**/api/me/orgs', (route) =>
    route.fulfill(json({ orgs: [{ id: 'org1', name: 'Acme', role, status: 'active' }] })),
  );

  await page.route('**/api/issues', (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON?.() ?? {};
      return route.fulfill(json({ ...ISSUE, id: 99, ...body }));
    }
    return route.fulfill(json({ issues }));
  });
  await page.route('**/api/issues/*', (route) => {
    if (route.request().method() === 'DELETE') return route.fulfill(json({}));
    const body = route.request().postDataJSON?.() ?? {};
    return route.fulfill(json({ ...ISSUE, ...body }));
  });

  // Platform owner control plane.
  await page.route('**/api/platform/orgs', (route) =>
    route.fulfill(json({ orgs: [{ id: 'org1', name: 'Acme', admins: [{ email: USER.email }] }] })),
  );

  await page.route('**/api/members', (route) => route.fulfill(json({ members: [MEMBER] })));
  await page.route('**/api/priorities', (route) => route.fulfill(json({ priorities: [PRIORITY] })));
  await page.route('**/api/categories', (route) => route.fulfill(json({ categories: [CATEGORY] })));
}

/** Seed a persisted session so the app boots signed in. */
export async function seedSession(page: Page, opts: MockOptions = {}): Promise<void> {
  const session = {
    token: 'e2e-token',
    user: USER,
    role: opts.role ?? 'admin',
    perms: opts.permissions ?? PERMS_ADMIN,
    orgId: 'org1',
  };
  await page.addInitScript((s) => {
    localStorage.setItem('authToken', JSON.stringify(s.token));
    localStorage.setItem('authUser', JSON.stringify(s.user));
    localStorage.setItem('authRole', JSON.stringify(s.role));
    localStorage.setItem('authPerms', JSON.stringify(s.perms));
    localStorage.setItem('authOrgId', JSON.stringify(s.orgId));
  }, session);
}

/** Mock the backend, seed the session, and navigate to a signed-in route. */
export async function gotoSignedIn(page: Page, path: string, opts: MockOptions = {}): Promise<void> {
  await mockBackend(page, opts);
  await seedSession(page, opts);
  await page.goto(path);
}

/**
 * Run an axe-core accessibility scan against the current page state and fail on
 * any WCAG A/AA violation. Call this from a spec once it has navigated to the
 * state you want to audit (list loaded, dialog open, etc.). Pass `exclude`
 * selectors to skip nodes whose markup we don't own (e.g. a third-party widget
 * with a known issue) — prefer fixing over excluding.
 */
export async function checkA11y(page: Page, exclude: string[] = []): Promise<void> {
  // Wait for entrance animations (e.g. the modal fade-in) to finish. Scanning
  // mid-animation reads partially-composited colors and reports spurious
  // contrast failures, so settle first for a deterministic result.
  await page.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running'));

  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  for (const selector of exclude) builder = builder.exclude(selector);

  const { violations } = await builder.analyze();

  const summary = violations
    .map((v) => `  [${v.impact ?? 'n/a'}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n    ${v.helpUrl}`)
    .join('\n');
  expect(violations, `Accessibility violations found:\n${summary}`).toEqual([]);
}
