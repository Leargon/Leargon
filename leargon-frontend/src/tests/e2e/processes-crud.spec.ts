import { test, expect } from '@playwright/test';
import { createProcess, uid, OWNER } from './api-setup';

// ──────────────────────────────────────────────────────────────────────────────
// Admin tests — uses default project storageState (.auth/admin.json)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Business Process CRUD — Admin', () => {
  let processKey: string;
  let processName: string;

  test.beforeEach(async () => {
    processName = uid('PW Process');
    const process = await createProcess(processName);
    processKey = process.key as string;
  });

  test('can create a business process via UI', async ({ page }) => {
    const newName = uid('PW New Process');

    await page.goto('/processes');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('dialog').getByLabel('Name (English)').fill(newName);
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10_000 });
  });

  test('can rename a business process', async ({ page }) => {
    const newName = uid('PW Renamed Process');

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await page.locator('button:has([data-testid="EditIcon"])').first().click();
    const nameInput = page.getByLabel('Name (English)');
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10_000 });
  });

  test('can delete a business process', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).toHaveURL(/\/processes/, { timeout: 10_000 });
    await expect(page.getByText(processName)).not.toBeVisible({ timeout: 5_000 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Owner tests — process created by owner, so they have edit/delete rights
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Business Process CRUD — Owner', () => {
  test.use({ storageState: '.auth/owner.json' });

  let processKey: string;

  test.beforeEach(async () => {
    // Create process as OWNER — creator automatically becomes processOwner
    const process = await createProcess(uid('PW Owner Process'), OWNER);
    processKey = process.key as string;
  });

  test('can rename their business process', async ({ page }) => {
    const newName = uid('PW Owner Renamed Process');

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await page.locator('button:has([data-testid="EditIcon"])').first().click();
    const nameInput = page.getByLabel('Name (English)');
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByRole('heading', { name: newName })).toBeVisible({ timeout: 10_000 });
  });

  test('can delete their business process', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).toHaveURL(/\/processes/, { timeout: 10_000 });
  });

  test('cannot see the New button', async ({ page }) => {
    await page.goto('/processes');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'New' })).not.toBeVisible();
  });

  test('cannot change the process owner', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    // Locate the Process Owner section and assert no edit icon is adjacent to it
    const ownerSection = page.getByText('Process Owner', { exact: false });
    await expect(ownerSection).toBeVisible();
    await expect(
      ownerSection.locator('..').locator('button:has([data-testid="EditIcon"])'),
    ).not.toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Viewer tests — plain authenticated user, no ownership
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Business Process CRUD — Viewer', () => {
  test.use({ storageState: '.auth/viewer.json' });

  let processKey: string;

  test.beforeEach(async () => {
    const process = await createProcess(uid('PW Viewer Process'));
    processKey = process.key as string;
  });

  test('cannot see edit controls on process detail', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button:has([data-testid="EditIcon"])')).not.toBeVisible();
  });

  test('cannot see the Delete button on process detail', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible();
  });
});
