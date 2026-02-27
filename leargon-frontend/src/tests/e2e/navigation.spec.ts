import { test, expect } from '@playwright/test';

// Uses admin auth via project config (storageState: '.auth/admin.json')

test('after login, / redirects to /domains', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/domains/, { timeout: 10_000 });
});

test('can navigate to /entities', async ({ page }) => {
  await page.goto('/entities');
  await expect(page).toHaveURL(/\/entities/);
  await expect(page.getByRole('alert')).not.toBeVisible();
});

test('can navigate to /processes', async ({ page }) => {
  await page.goto('/processes');
  await expect(page).toHaveURL(/\/processes/);
  await expect(page.getByRole('alert')).not.toBeVisible();
});

test('can navigate to /organisation', async ({ page }) => {
  await page.goto('/organisation');
  await expect(page).toHaveURL(/\/organisation/);
  await expect(page.getByRole('alert')).not.toBeVisible();
});
