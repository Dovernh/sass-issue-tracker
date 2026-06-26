import { expect, test } from '@playwright/test';

import { checkA11y, gotoSignedIn, PERMS_VIEWER } from './fixtures';

/** The admin area: the Users tab and access control. */

test('shows the members list on the Users tab', async ({ page }) => {
  await gotoSignedIn(page, '/admin');

  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

  const grid = page.locator('app-grid');
  await expect(grid).toContainText('Paul H');
  await expect(grid).toContainText('paul@example.com');
});

test('exposes the admin section tabs', async ({ page }) => {
  await gotoSignedIn(page, '/admin');

  for (const tab of ['Users', 'Priority', 'Category', 'Roles']) {
    await expect(page.getByRole('link', { name: tab })).toBeVisible();
  }
});

test('the admin Users tab has no accessibility violations', async ({ page }) => {
  await gotoSignedIn(page, '/admin');
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

  await checkA11y(page);
});

test('keeps members without permission out of admin', async ({ page }) => {
  await gotoSignedIn(page, '/admin', { permissions: PERMS_VIEWER, role: 'viewer' });

  // The members:view guard redirects; a viewer with no perms ends up on issues.
  await expect(page).toHaveURL(/\/issues$/);
  await expect(page.getByRole('heading', { name: 'Issues' })).toBeVisible();
});
