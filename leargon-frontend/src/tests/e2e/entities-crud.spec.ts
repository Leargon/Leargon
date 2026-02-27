import { test, expect } from '@playwright/test';
import { createEntity, uid, OWNER } from './api-setup';

// ──────────────────────────────────────────────────────────────────────────────
// Admin tests — uses default project storageState (.auth/admin.json)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Business Entity CRUD — Admin', () => {
  let entityKey: string;
  let entityName: string;

  test.beforeEach(async () => {
    entityName = uid('PW Entity');
    const entity = await createEntity(entityName);
    entityKey = entity.key as string;
  });

  test('can create a business entity via UI', async ({ page }) => {
    const newName = uid('PW New Entity');

    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('dialog').getByLabel('Name (English)').fill(newName);
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10_000 });
  });

  test('can rename a business entity', async ({ page }) => {
    const newName = uid('PW Renamed Entity');

    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await page.locator('button:has([data-testid="EditIcon"])').first().click();
    const nameInput = page.getByLabel('Name (English)');
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10_000 });
  });

  test('can delete a business entity', async ({ page }) => {
    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).toHaveURL(/\/entities/, { timeout: 10_000 });
    await expect(page.getByText(entityName)).not.toBeVisible({ timeout: 5_000 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Owner tests — entity created by owner, so they have edit/delete rights
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Business Entity CRUD — Owner', () => {
  test.use({ storageState: '.auth/owner.json' });

  let entityKey: string;

  test.beforeEach(async () => {
    // Create entity as OWNER — creator automatically becomes dataOwner
    const entity = await createEntity(uid('PW Owner Entity'), OWNER);
    entityKey = entity.key as string;
  });

  test('can rename their business entity', async ({ page }) => {
    const newName = uid('PW Owner Renamed Entity');

    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await page.locator('button:has([data-testid="EditIcon"])').first().click();
    const nameInput = page.getByLabel('Name (English)');
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10_000 });
  });

  test('can delete their business entity', async ({ page }) => {
    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).toHaveURL(/\/entities/, { timeout: 10_000 });
  });

  test('cannot see the New button', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'New' })).not.toBeVisible();
  });

  test('cannot change the data owner', async ({ page }) => {
    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    // Locate the Data Owner section and assert no edit icon is adjacent to it
    const dataOwnerSection = page.getByText('Data Owner', { exact: false });
    await expect(dataOwnerSection).toBeVisible();
    await expect(
      dataOwnerSection.locator('..').locator('button:has([data-testid="EditIcon"])'),
    ).not.toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Viewer tests — plain authenticated user, no ownership
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Business Entity CRUD — Viewer', () => {
  test.use({ storageState: '.auth/viewer.json' });

  let entityKey: string;

  test.beforeEach(async () => {
    const entity = await createEntity(uid('PW Viewer Entity'));
    entityKey = entity.key as string;
  });

  test('cannot see edit controls on entity detail', async ({ page }) => {
    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button:has([data-testid="EditIcon"])')).not.toBeVisible();
  });

  test('cannot see the Delete button on entity detail', async ({ page }) => {
    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible();
  });
});
