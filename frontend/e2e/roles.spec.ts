import { expect, test } from '@playwright/test';

import { checkA11y, gotoSignedIn, PERMS_ADMIN, PERMS_MEMBER, PERMS_VIEWER } from './fixtures';

/**
 * Role-based access. The session's role/permissions come from the mocked
 * `/api/me`, so each test boots the app "as" a different profile and asserts
 * what that profile can see and do.
 */

test.describe('admin', () => {
  test.beforeEach(({ page }) =>
    gotoSignedIn(page, '/issues', { role: 'admin', permissions: PERMS_ADMIN }),
  );

  test('sees every navbar section', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
  });

  test('can create, edit, and delete issues', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Add issue' })).toBeVisible();

    await page.getByRole('button', { name: 'Row actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  });

  test('the open row-actions menu has no accessibility violations', async ({ page }) => {
    await page.getByRole('button', { name: 'Row actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();

    await checkA11y(page);
  });
});

test.describe('member', () => {
  test.beforeEach(({ page }) =>
    gotoSignedIn(page, '/issues', { role: 'member', permissions: PERMS_MEMBER }),
  );

  test('sees the dashboard but not the admin section', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  test('can create and edit issues but not delete them', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Add issue' })).toBeVisible();

    await page.getByRole('button', { name: 'Row actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  });
});

test.describe('viewer', () => {
  test.beforeEach(({ page }) =>
    gotoSignedIn(page, '/issues', { role: 'viewer', permissions: PERMS_VIEWER }),
  );

  test('sees only the issues section', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Issues' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  test('cannot create or act on issues', async ({ page }) => {
    await expect(page.locator('app-grid')).toContainText('High');
    await expect(page.getByRole('button', { name: 'Add issue' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Row actions' })).toHaveCount(0);
  });
});

test.describe('platform owner', () => {
  test('lands on the organizations control plane', async ({ page }) => {
    await gotoSignedIn(page, '/', { platformRole: 'owner', permissions: [] });

    await expect(page).toHaveURL(/\/owner$/);
    await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Organizations' })).toBeVisible();

    await checkA11y(page);
  });

  test('is redirected away from org-scoped routes', async ({ page }) => {
    await gotoSignedIn(page, '/issues', { platformRole: 'owner', permissions: [] });

    await expect(page).toHaveURL(/\/owner$/);
  });
});
