import { test, expect } from '@playwright/test';
import {
  uid,
  createItSystem,
  createProcess,
  linkItSystemToProcesses,
} from './api-setup';

// ─── Admin: IT Systems page ───────────────────────────────────────────────────

test.describe('IT Systems Page — Admin', () => {
  test('IT Systems page shows empty state', async ({ page }) => {
    await page.goto('/it-systems');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Select an IT system')).toBeVisible();
  });

  test('admin can create an IT system via UI', async ({ page }) => {
    const name = uid('PW IT System');

    await page.goto('/it-systems');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name (English)').fill(name);

    await dialog.getByRole('button', { name: 'Create' }).click();

    await page.waitForLoadState('networkidle');
    // After creation, navigates to the detail; system name appears in list
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
  });

  test('admin can delete an IT system via UI', async ({ page }) => {
    const name = uid('PW Delete IT System');
    const system = await createItSystem(name);
    const systemKey = system.key as string;

    await page.goto(`/it-systems/${systemKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();

    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name })).not.toBeVisible({ timeout: 10_000 });
  });

  test('delete IT system → linked processes still exist in UI', async ({ page }) => {
    const systemName = uid('PW System With Procs');
    const procName = uid('PW Process Linked To System');

    const system = await createItSystem(systemName);
    const proc = await createProcess(procName);
    const systemKey = system.key as string;
    const procKey = proc.key as string;

    // Link the process to the IT system via API
    await linkItSystemToProcesses(systemKey, [procKey]);

    // Delete the system via UI
    await page.goto(`/it-systems/${systemKey}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Navigate to the process — it should still exist
    await page.goto(`/processes/${procKey}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: procName })).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Non-admin: IT Systems page (read-only) ───────────────────────────────────

test.describe('IT Systems Page — Non-admin', () => {
  test.use({ storageState: '.auth/owner.json' });

  test('non-admin can view IT systems but Add button is not visible', async ({ page }) => {
    await page.goto('/it-systems');
    await page.waitForLoadState('networkidle');

    const addButton = page.getByRole('button', { name: 'New' });
    await expect(addButton).not.toBeVisible();
  });
});