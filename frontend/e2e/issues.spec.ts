import { expect, test } from '@playwright/test';

import { checkA11y, gotoSignedIn, PERMS_VIEWER } from './fixtures';

/** The issues list: rendering, create, delete, and permission gating. */

test('lists issues with resolved priority/category and assignee', async ({ page }) => {
  await gotoSignedIn(page, '/issues');

  const grid = page.locator('app-grid');
  await expect(grid).toContainText('High');
  await expect(grid).toContainText('Feature request');
  await expect(grid).toContainText('Paul H');
});

test('creates an issue', async ({ page }) => {
  await gotoSignedIn(page, '/issues');

  await page.getByRole('button', { name: 'Add issue' }).click();
  await expect(page.getByRole('heading', { name: 'New issue' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Description' }).click();
  await page.keyboard.type('A brand new bug report');
  await page.getByRole('button', { name: 'Create issue' }).click();

  await expect(page.getByRole('alert')).toContainText('Issue created.');
});

test('the new-issue dialog traps focus and restores it on Escape', async ({ page }) => {
  await gotoSignedIn(page, '/issues');

  const trigger = page.getByRole('button', { name: 'Add issue' });
  await trigger.click();

  const dialog = page.getByRole('dialog');
  await expect(page.getByRole('heading', { name: 'New issue' })).toBeVisible();

  const focusIsInDialog = () => dialog.evaluate((d) => d.contains(document.activeElement));

  // Opening moves focus into the dialog rather than leaving it on the trigger.
  expect(await focusIsInDialog()).toBe(true);

  // Tabbing through every control stays trapped inside the dialog and wraps —
  // it never escapes to the issues list behind it. The dialog has ~10 focusable
  // controls (close, editor toolbar, editor, three selects, two actions), so 15
  // presses guarantees at least one full cycle.
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    expect(await focusIsInDialog()).toBe(true);
  }

  // Escape closes the dialog and returns focus to the trigger that opened it.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'New issue' })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('the issues list and new-issue dialog have no accessibility violations', async ({ page }) => {
  await gotoSignedIn(page, '/issues');

  // List state, including the ag-grid and the Add issue control.
  await expect(page.locator('app-grid')).toContainText('High');
  await checkA11y(page);

  // Dialog state, including the rich-text description editor.
  await page.getByRole('button', { name: 'Add issue' }).click();
  await expect(page.getByRole('heading', { name: 'New issue' })).toBeVisible();
  await checkA11y(page);
});

test('asks for confirmation and calls the API when deleting', async ({ page }) => {
  await gotoSignedIn(page, '/issues');

  await page.getByRole('button', { name: 'Row actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  await expect(page.getByRole('heading', { name: 'Delete issue' })).toBeVisible();

  const deleted = page.waitForRequest(
    (r) => r.method() === 'DELETE' && /\/api\/issues\/6$/.test(r.url()),
  );
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await deleted;
});

test('hides create and row actions from members without permission', async ({ page }) => {
  await gotoSignedIn(page, '/issues', { permissions: PERMS_VIEWER, role: 'viewer' });

  await expect(page.locator('app-grid')).toContainText('High');
  await expect(page.getByRole('button', { name: 'Add issue' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Row actions' })).toHaveCount(0);
});
