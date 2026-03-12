import { test, expect } from '@playwright/test';
import {
  uid,
  createEntity,
  createDataProcessor,
  linkDataProcessorEntities,
} from './api-setup';

// ─── Admin: Data Processors page ─────────────────────────────────────────────

test.describe('Data Processors Page — Admin', () => {
  test('Data Processors page shows empty state', async ({ page }) => {
    await page.goto('/data-processors');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Select a data processor')).toBeVisible();
  });

  test('admin can create a data processor via UI', async ({ page }) => {
    const name = uid('PW Processor');

    await page.goto('/data-processors');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name (English)').fill(name);

    await dialog.getByRole('button', { name: 'Create' }).click();

    await page.waitForLoadState('networkidle');
    // After creation, navigates to the detail; processor name appears in list
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
  });

  test('admin can delete a data processor via UI', async ({ page }) => {
    const name = uid('PW Delete Processor');
    const processor = await createDataProcessor(name);
    const processorKey = processor.key as string;

    await page.goto(`/data-processors/${processorKey}`);
    await page.waitForLoadState('networkidle');

    // Click the Delete button in the detail panel header
    await page.getByRole('button', { name: 'Delete' }).click();

    // Confirm deletion dialog
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: 'Delete' }).click();

    await page.waitForLoadState('networkidle');
    // Should navigate back to list; processor no longer in list
    await expect(page.getByText(name)).not.toBeVisible({ timeout: 10_000 });
  });
});

// ─── Entity detail: Data Processors section ──────────────────────────────────

test.describe('Entity Detail — Data Processors section', () => {
  test('linked data processor appears on entity detail page', async ({ page }) => {
    const processorName = uid('PW Entity Processor');
    const processor = await createDataProcessor(processorName);
    const processorKey = processor.key as string;

    const entity = await createEntity(uid('PW Entity For Processor'));
    const entityKey = entity.key as string;

    await linkDataProcessorEntities(processorKey, [entityKey]);

    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    // The entity detail panel should show the processor chip
    await expect(page.getByText(processorName)).toBeVisible({ timeout: 10_000 });
  });

  test('entity detail shows "No data processors linked" when none linked', async ({
    page,
  }) => {
    const entity = await createEntity(uid('PW No Processor Entity'));
    const entityKey = entity.key as string;

    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('No data processors linked')).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Non-admin: Data Processors page (read-only) ─────────────────────────────

test.describe('Data Processors Page — Non-admin', () => {
  test.use({ storageState: '.auth/owner.json' });

  test('non-admin can view data processors but Add button is not visible', async ({
    page,
  }) => {
    await page.goto('/data-processors');
    await page.waitForLoadState('networkidle');

    const addButton = page.getByRole('button', { name: 'New' });
    await expect(addButton).not.toBeVisible();
  });
});
