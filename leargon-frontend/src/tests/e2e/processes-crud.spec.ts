import { test, expect } from '@playwright/test';
import { createProcess, setProcessLegalBasis, uid, OWNER } from './api-setup';

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

    await expect(page.getByRole('heading', { name: newName })).toBeVisible({ timeout: 10_000 });
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

    await expect(page.getByRole('heading', { name: newName })).toBeVisible({ timeout: 10_000 });
  });

  test('can delete a business process', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).not.toHaveURL(new RegExp(`/processes/${processKey}`), { timeout: 10_000 });
  });
});

  test('admin can set legal basis via UI', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    // Find the Legal Basis section and click its edit button
    const legalBasisSection = page.getByText('Legal Basis', { exact: true });
    await legalBasisSection.locator('..').getByRole('button', { name: '' }).first().click();

    // Select "Contract" from the dropdown
    await page.getByRole('combobox').last().click();
    await page.getByRole('option', { name: 'Contract' }).click();

    // Save
    await page.locator('button:has([data-testid="CheckIcon"])').last().click();

    await expect(page.getByText('Contract', { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('legal basis chip is visible when set', async ({ page }) => {
    await setProcessLegalBasis(processKey, 'LEGAL_OBLIGATION');

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Legal Obligation', { exact: false })).toBeVisible();
  });

  test('legal basis shows "Not set" when not set', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    const legalBasisSection = page.getByText('Legal Basis', { exact: true });
    await expect(legalBasisSection).toBeVisible();
    // The Not set text is within the same section
    await expect(page.getByText('Not set').first()).toBeVisible();
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

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).not.toHaveURL(new RegExp(`/processes/${processKey}`), { timeout: 10_000 });
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

  test('can see legal basis chip but not edit it', async ({ page }) => {
    await setProcessLegalBasis(processKey, 'CONSENT');

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Consent', { exact: false })).toBeVisible();
    await expect(page.locator('button:has([data-testid="EditIcon"])')).not.toBeVisible();
  });

  test('cannot see the Delete button on process detail', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible();
  });
});
