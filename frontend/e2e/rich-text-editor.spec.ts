import { expect, test } from '@playwright/test';

import { checkA11y, gotoSignedIn } from './fixtures';

/**
 * The rich-text description editor end-to-end: the list shows a plain-text
 * preview of the stored HTML, the edit dialog renders the rich content and its
 * Format menu, and the toolbar's Bold applies to typed text.
 */

test.beforeEach(async ({ page }) => {
  await gotoSignedIn(page, '/issues');
});

test('shows a plain-text preview of the rich description in the list', async ({ page }) => {
  const cell = page.locator('.ag-cell[col-id="descriptionText"]');

  await expect(cell).toContainText('Reference site about Lorem Ipsum');
  await expect(cell).not.toContainText('<strong>');
  await expect(cell).not.toContainText('<p>');
});

test('renders the stored rich content and opens the Format menu in the editor', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Row actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();

  await expect(page.getByRole('heading', { name: 'Edit issue' })).toBeVisible();

  const editor = page.getByRole('textbox', { name: 'Description' });
  await expect(editor).toBeVisible();
  await expect(editor.locator('strong')).toHaveText('Reference');

  await page.getByRole('button', { name: 'Format' }).click();
  await expect(page.getByRole('menuitem', { name: 'Heading 2' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Heading 2' })).toHaveCount(0);
});

test('the editor and its open Format menu have no accessibility violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Row actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit issue' })).toBeVisible();

  await page.getByRole('button', { name: 'Format' }).click();
  await expect(page.getByRole('menuitem', { name: 'Heading 2' })).toBeVisible();

  await checkA11y(page);
});

test('applies Bold from the toolbar to text typed in a new issue', async ({ page }) => {
  await page.getByRole('button', { name: 'Add issue' }).click();
  await expect(page.getByRole('heading', { name: 'New issue' })).toBeVisible();

  // Type, select all, then Bold — deterministic, unlike toggling a stored
  // mark on an empty doc and hoping it survives until the next keystroke.
  await page.getByRole('textbox', { name: 'Description' }).click();
  await page.keyboard.type('Hello');
  await page.keyboard.press('ControlOrMeta+a');
  await page.getByRole('button', { name: 'Bold' }).click();

  await expect(page.locator('.rte__content strong')).toHaveText('Hello');
  await expect(page.getByRole('button', { name: 'Bold' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
