import { expect, test } from '@playwright/test';

import { checkA11y, gotoSignedIn } from './fixtures';

/** The dashboard: issue totals and the summary charts. */

test('shows the issue total and renders the charts', async ({ page }) => {
  await gotoSignedIn(page, '/dashboard');

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // One issue is mocked.
  await expect(page.locator('.dashboard__total')).toContainText('Total issues: 1');

  // Charts render to <canvas> with descriptive accessible names.
  await expect(page.locator('canvas[aria-label*="Issues by status"]')).toBeVisible();
  await expect(page.locator('canvas[aria-label*="Issues by priority"]')).toBeVisible();
});

test('dashboard has no accessibility violations', async ({ page }) => {
  await gotoSignedIn(page, '/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await checkA11y(page);
});
