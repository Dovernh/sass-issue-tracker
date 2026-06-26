import { expect, test } from '@playwright/test';

import { checkA11y, gotoSignedIn, mockBackend } from './fixtures';

/** Signed-out landing, the sign-in flow, and signing back out. */

test('signed-out visitors see the landing hero and a sign-in prompt', async ({ page }) => {
  await mockBackend(page); // no session seeded → app boots signed out
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in to get started.' })).toBeVisible();

  await checkA11y(page);
});

test('the sign-in form has no accessibility violations', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Sign in to get started.' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await checkA11y(page);
});

test('a user can sign in from the landing page', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Sign in to get started.' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page.getByLabel('Email', { exact: true }).fill('paul@example.com');
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // onLoggedIn navigates an org member to the dashboard.
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('a signed-in user can log out', async ({ page }) => {
  await gotoSignedIn(page, '/issues');

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page.getByRole('button', { name: 'Sign in to get started.' })).toBeVisible();
});
