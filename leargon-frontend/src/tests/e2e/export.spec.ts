import { test, expect } from '@playwright/test';
import { uid, createProcess } from './api-setup';

test.describe('Compliance Exports (Admin)', () => {
  test('admin can see export button on compliance page', async ({ page }) => {
    await page.goto('/compliance');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /export/i })).toBeVisible({ timeout: 10_000 });
  });

  test('export button opens a menu with three options', async ({ page }) => {
    await page.goto('/compliance');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /export/i }).click();

    await expect(page.getByRole('menuitem', { name: /processing register/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('menuitem', { name: /sub-processor/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /dpia/i })).toBeVisible();
  });

  test('clicking processing register export triggers download', async ({ page }) => {
    // Create a process to have data in the export
    await createProcess(uid('PW Export Process'));

    await page.goto('/compliance');
    await page.waitForLoadState('networkidle');

    // Start waiting for download before clicking
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByRole('menuitem', { name: /processing register/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('processing-register.csv');
  });

  test('clicking sub-processor register export triggers download', async ({ page }) => {
    await page.goto('/compliance');
    await page.waitForLoadState('networkidle');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByRole('menuitem', { name: /sub-processor/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('data-processors.csv');
  });

  test('clicking DPIA register export triggers download', async ({ page }) => {
    await page.goto('/compliance');
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
