import { test, expect } from '@playwright/test';
import { uid, createProcess } from './api-setup';

test.describe('Compliance Exports (Admin)', () => {
  test('admin can see export button on compliance page', async ({ page }) => {
    await page.goto('/compliance');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /export/i })).toBeVisible({ timeout: 10_000 });
  });

  test('compliance page has a direct export button for processing register', async ({ page }) => {
    await page.goto('/compliance');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /export processing register/i })).toBeVisible({ timeout: 10_000 });
  });

  test('clicking processing register export triggers download', async ({ page }) => {
    await page.goto('/compliance');
    await page.waitForLoadState('networkidle');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export processing register/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('processing-register.csv');
  });

  test('clicking service providers export triggers download', async ({ page }) => {
    await page.goto('/service-providers');
    await page.waitForLoadState('networkidle');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByRole('menuitem', { name: /service provider/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('service-providers.csv');
  });

  test('clicking DPIA register export triggers download', async ({ page }) => {
    await page.goto('/dpia');
    await page.waitForLoadState('networkidle');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByRole('menuitem', { name: /dpia/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('dpia-register.csv');
  });
});

test.describe('Compliance Exports (Viewer)', () => {
  test.use({ storageState: '.auth/viewer.json' });

  test('viewer cannot see export button on compliance page', async ({ page }) => {
    await page.goto('/compliance');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /export/i })).not.toBeVisible();
  });
});
