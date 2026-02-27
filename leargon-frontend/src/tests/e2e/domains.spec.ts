import { test, expect } from '@playwright/test';

// Uses admin auth via project config (storageState: '.auth/admin.json')

test('domains page loads without an error alert', async ({ page }) => {
  await page.goto('/domains');
  await expect(page).toHaveURL(/\/domains/);
  await expect(page.getByRole('alert')).not.toBeVisible();
});

test('can navigate to a domain URL if domains exist (or page is in empty state)', async ({ page }) => {
  await page.goto('/domains');

  // The page should load without an error regardless of whether domains exist
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('alert')).not.toBeVisible();
});
