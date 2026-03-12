import { test, expect } from '@playwright/test';
import { uid, createEntity, createProcess, updateCrossBorderTransfers, OWNER } from './api-setup';

// ─── Entity: Cross-border Transfers ─────────────────────────────────────────

test.describe('Cross-border Transfers — Entity Detail (Admin)', () => {
  test('entity detail shows "No cross-border transfers recorded" by default', async ({
    page,
  }) => {
    const entity = await createEntity(uid('PW CBT Entity'));
    const entityKey = entity.key as string;

    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('No cross-border transfers recorded')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('admin can add a cross-border transfer on entity detail', async ({ page }) => {
    const entity = await createEntity(uid('PW CBT Add Entity'));
    const entityKey = entity.key as string;

    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    // Click the edit (pencil) icon next to "Cross-border Transfers"
    const section = page.locator('text=Cross-border Transfers').first();
    await section.locator('..').getByRole('button').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Select country
    await dialog.getByLabel('Country').fill('Germany');
    await page.getByRole('option', { name: /Germany/ }).click();

    // Select safeguard
    await dialog.getByRole('combobox').last().click();
    await page.getByRole('option', { name: 'Adequacy Decision' }).click();

    // Click Add
    await dialog.getByRole('button', { name: 'Add' }).click();

    // Save
    await dialog.getByRole('button', { name: 'Save' }).click();

    await page.waitForLoadState('networkidle');

    // Transfer should now be visible
    await expect(page.getByText('Germany')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Adequacy Decision')).toBeVisible({ timeout: 10_000 });
  });

  test('existing cross-border transfers are displayed on entity detail', async ({
    page,
  }) => {
    const entity = await createEntity(uid('PW CBT Display Entity'));
    const entityKey = entity.key as string;

    await updateCrossBorderTransfers(
      entityKey,
      [
        { destinationCountry: 'US', safeguard: 'STANDARD_CONTRACTUAL_CLAUSES', notes: 'Signed 2024' },
      ],
      'business-entities',
    );

    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('United States')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Standard Contractual Clauses')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Signed 2024')).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Owner: Cross-border Transfers ──────────────────────────────────────────

test.describe('Cross-border Transfers — Entity Detail (Owner)', () => {
  test.use({ storageState: '.auth/owner.json' });

  test('owner can edit cross-border transfers on their entity', async ({ page }) => {
    const entity = await createEntity(uid('PW Owner CBT Entity'), OWNER);
    const entityKey = entity.key as string;

    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    // Edit button should be visible for owner
    const section = page.locator('text=Cross-border Transfers').first();
    const editButton = section.locator('..').getByRole('button');
    await expect(editButton).toBeVisible({ timeout: 10_000 });
  });

  test('owner cannot see edit button on cross-border transfers for another owner entity', async ({
    page,
  }) => {
    // Create entity as admin (different owner)
    const entity = await createEntity(uid('PW Admin Entity No Edit'));
    const entityKey = entity.key as string;

    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    // The Cross-border Transfers section exists but has no edit button
    await expect(page.getByText('Cross-border Transfers')).toBeVisible({ timeout: 10_000 });
    const section = page.locator('text=Cross-border Transfers').first();
    const editButton = section.locator('..').getByRole('button');
    await expect(editButton).not.toBeVisible();
  });
});

// ─── Process: Cross-border Transfers ────────────────────────────────────────

test.describe('Cross-border Transfers — Process Detail (Admin)', () => {
  test('existing process cross-border transfers are displayed', async ({ page }) => {
    const process = await createProcess(uid('PW CBT Process'));
    const processKey = process.key as string;

    await updateCrossBorderTransfers(
      processKey,
      [{ destinationCountry: 'JP', safeguard: 'BINDING_CORPORATE_RULES' }],
      'processes',
    );

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Japan')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Binding Corporate Rules')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can add cross-border transfer to process', async ({ page }) => {
    const process = await createProcess(uid('PW CBT Add Process'));
    const processKey = process.key as string;

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    const section = page.locator('text=Cross-border Transfers').first();
    await section.locator('..').getByRole('button').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Country').fill('France');
    await page.getByRole('option', { name: /France/ }).click();

    await dialog.getByRole('combobox').last().click();
    await page.getByRole('option', { name: 'Adequacy Decision' }).click();

    await dialog.getByRole('button', { name: 'Add' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();

    await page.waitForLoadState('networkidle');
    await expect(page.getByText('France')).toBeVisible({ timeout: 10_000 });
  });
});
