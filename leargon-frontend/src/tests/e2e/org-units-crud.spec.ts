import { test, expect } from '@playwright/test';
import { createOrgUnit, uid, ADMIN, OWNER } from './api-setup';

// ──────────────────────────────────────────────────────────────────────────────
// Admin tests — uses default project storageState (.auth/admin.json)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Organisational Unit CRUD — Admin', () => {
  let unitKey: string;
  let unitName: string;

  test.beforeEach(async () => {
    unitName = uid('PW OrgUnit');
    const unit = await createOrgUnit(unitName);
    unitKey = unit.key as string;
  });

  test('can create an organisational unit via UI', async ({ page }) => {
    const newName = uid('PW New OrgUnit');

    await page.goto('/organisation');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('dialog').getByLabel('Name (English)').fill(newName);
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10_000 });
  });

  test('can rename an organisational unit', async ({ page }) => {
    const newName = uid('PW Renamed OrgUnit');

    await page.goto(`/organisation/${unitKey}`);
    await page.waitForLoadState('networkidle');

    await page.locator('button:has([data-testid="EditIcon"])').first().click();
    const nameInput = page.getByLabel('Name (English)');
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10_000 });
  });

  test('can delete an organisational unit', async ({ page }) => {
    await page.goto(`/organisation/${unitKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).toHaveURL(/\/organisation/, { timeout: 10_000 });
    await expect(page.getByText(unitName)).not.toBeVisible({ timeout: 5_000 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Lead tests — org unit created by owner user, who becomes lead automatically
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Organisational Unit CRUD — Lead', () => {
  test.use({ storageState: '.auth/owner.json' });

  let unitKey: string;

  test.beforeEach(async () => {
    // Root org units require admin. Create as admin with e2eowner as lead.
    const unit = await createOrgUnit(uid('PW Lead OrgUnit'), ADMIN, 'e2eowner');
    unitKey = unit.key as string;
  });

  test('can rename their organisational unit', async ({ page }) => {
    const newName = uid('PW Lead Renamed OrgUnit');

    await page.goto(`/organisation/${unitKey}`);
    await page.waitForLoadState('networkidle');

    await page.locator('button:has([data-testid="EditIcon"])').first().click();
    const nameInput = page.getByLabel('Name (English)');
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10_000 });
  });

  test('can delete their organisational unit', async ({ page }) => {
    await page.goto(`/organisation/${unitKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).toHaveURL(/\/organisation/, { timeout: 10_000 });
  });

  test('cannot see the New button', async ({ page }) => {
    await page.goto('/organisation');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'New' })).not.toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Viewer tests — plain authenticated user, no ownership
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Organisational Unit CRUD — Viewer', () => {
  test.use({ storageState: '.auth/viewer.json' });

  let unitKey: string;

  test.beforeEach(async () => {
    const unit = await createOrgUnit(uid('PW Viewer OrgUnit'));
    unitKey = unit.key as string;
  });

  test('cannot see edit controls on org unit detail', async ({ page }) => {
    await page.goto(`/organisation/${unitKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button:has([data-testid="EditIcon"])')).not.toBeVisible();
  });

  test('cannot see the Delete button on org unit detail', async ({ page }) => {
    await page.goto(`/organisation/${unitKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible();
  });
});
