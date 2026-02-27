import { test, expect } from '@playwright/test';

// Override storageState — these tests verify the unauthenticated flow
test.use({ storageState: { cookies: [], origins: [] } });

test('navigating to a protected route without auth redirects to /login', async ({ page }) => {
  await page.goto('/domains');
  await expect(page).toHaveURL(/\/login/);
});

test('login page renders the sign-in form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});

test('login with valid credentials navigates to /domains', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill('admin@e2e-test.local');
  await page.getByLabel('Password').fill('AdminPass123!');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/domains/, { timeout: 10_000 });
});

test('login with invalid credentials shows an error alert', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill('admin@e2e-test.local');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
});
