import { test, expect } from '@playwright/test';
import { createDomain, uid } from './api-setup';

// ──────────────────────────────────────────────────────────────────────────────
// Admin tests — uses default project storageState (.auth/admin.json)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Business Domain CRUD — Admin', () => {
  let domainKey: string;
  let domainName: string;

  test.beforeEach(async () => {
    domainName = uid('PW Domain');
    const domain = await createDomain(domainName);
    domainKey = domain.key as string;
  });

  test('can create a business domain via UI', async ({ page }) => {
    const newName = uid('PW New Domain');

    await page.goto('/domains');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('dialog').getByLabel('Name (English)').fill(newName);
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10_000 });
  });

  test('can rename a business domain', async ({ page }) => {
    const newName = uid('PW Renamed Domain');

    await page.goto(`/domains/${domainKey}`);
    await page.waitForLoadState('networkidle');

    await page.locator('button:has([data-testid="EditIcon"])').first().click();
    const nameInput = page.getByLabel('Name (English)');
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByRole('heading', { name: newName })).toBeVisible({ timeout: 10_000 });
  });

  test('can delete a business domain', async ({ page }) => {
    await page.goto(`/domains/${domainKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    // After deletion we should no longer be on the detail page
    await expect(page).not.toHaveURL(new RegExp(`/domains/${domainKey}`), { timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Viewer tests — plain authenticated user, no ownership
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Business Domain CRUD — Viewer', () => {
  test.use({ storageState: '.auth/viewer.json' });

  let domainKey: string;

  test.beforeEach(async () => {
    const domain = await createDomain(uid('PW Viewer Domain'));
    domainKey = domain.key as string;
  });

  test('cannot see the New button', async ({ page }) => {
    await page.goto('/domains');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'New' })).not.toBeVisible();
  });

  test('cannot see edit controls on domain detail', async ({ page }) => {
    await page.goto(`/domains/${domainKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button:has([data-testid="EditIcon"])')).not.toBeVisible();
  });

  test('cannot see the Delete button on domain detail', async ({ page }) => {
    await page.goto(`/domains/${domainKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible();
  });
});
