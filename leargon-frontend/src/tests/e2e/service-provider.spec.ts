import { test, expect } from '@playwright/test';
import {
  uid,
  createServiceProvider,
} from './api-setup';

// ─── Admin: Service Providers page ───────────────────────────────────────────

test.describe('Service Providers Page — Admin', () => {
  test('Service Providers page shows empty state', async ({ page }) => {
    await page.goto('/service-providers');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Select a service provider')).toBeVisible();
  });

  test('admin can create a service provider via UI', async ({ page }) => {
    const name = uid('PW Provider');

    await page.goto('/service-providers');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name (English)').fill(name);

    await dialog.getByRole('button', { name: 'Create' }).click();

    await page.waitForLoadState('networkidle');
    // After creation, navigates to the detail; provider name appears in list
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
  });

  test('admin can delete a service provider via UI', async ({ page }) => {
    const name = uid('PW Delete Provider');
    const provider = await createServiceProvider(name);
    const providerKey = provider.key as string;

    await page.goto(`/service-providers/${providerKey}`);
    await page.waitForLoadState('networkidle');

    // Click the Delete button in the detail panel header
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();

    // Confirm deletion dialog
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await page.waitForLoadState('networkidle');
    // Should navigate back to list; detail panel for the deleted provider should be gone
    await expect(page.getByRole('heading', { name })).not.toBeVisible({ timeout: 10_000 });
  });
});

// ─── Non-admin: Service Providers page (read-only) ───────────────────────────

test.describe('Service Providers Page — Non-admin', () => {
  test.use({ storageState: '.auth/owner.json' });

  test('non-admin can view service providers but Add button is not visible', async ({
    page,
  }) => {
    await page.goto('/service-providers');
    await page.waitForLoadState('networkidle');

    const addButton = page.getByRole('button', { name: 'New' });
    await expect(addButton).not.toBeVisible();
  });
});
