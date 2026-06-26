import { expect, test } from '@playwright/test';

import { checkA11y, gotoSignedIn } from './fixtures';

/** The primary navbar: routing between sections and the theme toggle. */

test.beforeEach(async ({ page }) => {
  await gotoSignedIn(page, '/issues');
});

test('navigates between the main sections from the navbar', async ({ page }) => {
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

  await page.getByRole('link', { name: 'Issues' }).click();
  await expect(page).toHaveURL(/\/issues$/);
  await expect(page.getByRole('heading', { name: 'Issues' })).toBeVisible();
});

test('toggles the color theme', async ({ page }) => {
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  const after = before === 'dark' ? 'light' : 'dark';

  await page.getByRole('button', { name: 'Toggle light/dark theme' }).click();

  await expect(html).toHaveAttribute('data-theme', after);
});

test('the dark theme has no accessibility violations', async ({ page }) => {
  const html = page.locator('html');

  // Force the dark palette so we audit its contrast regardless of OS preference.
  if ((await html.getAttribute('data-theme')) !== 'dark') {
    await page.getByRole('button', { name: 'Toggle light/dark theme' }).click();
  }
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await checkA11y(page);
});
