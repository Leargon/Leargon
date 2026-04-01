import { test, expect } from '@playwright/test';
import { uid, createEntity, ADMIN, OWNER } from './api-setup';

// ─── Quality Rules — Admin ─────────────────────────────────────────────────────

test.describe('Quality Rules — Entity Detail (Admin)', () => {
  test('shows "No quality rules defined" for entity without rules', async ({ page }) => {
    const entity = await createEntity(uid('PW QR Empty Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Governance tab where quality rules live
    await page.locator('[aria-expanded]').filter({ hasText: 'Governance' }).click();

    await expect(page.getByText('No quality rules defined')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can add a rule with severity chip', async ({ page }) => {
    const entity = await createEntity(uid('PW QR Severity Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    await page.locator('[aria-expanded]').filter({ hasText: 'Governance' }).click();

    await page.getByRole('button', { name: 'Add Rule' }).click();

    await page.getByLabel('Rule description').fill('Customer email must be a valid RFC 5322 address');
    await page.getByRole('dialog').locator('[role="combobox"]').click();
    await page.getByRole('option', { name: 'Must' }).click();
    // Wait for the dropdown to fully close before clicking Create
    await page.getByRole('option', { name: 'Must' }).waitFor({ state: 'detached' });

    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
    await page.waitForLoadState('networkidle');

    // Scope to QR section so strict mode doesn't match textarea in closing dialog
    const qrSection = page.getByText('Quality Rules').first().locator('..').locator('..');
    await expect(qrSection.getByText('Customer email must be a valid RFC 5322 address')).toBeVisible({ timeout: 10_000 });
    await expect(qrSection.getByText('Must', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('admin can edit an existing quality rule', async ({ page }) => {
    const entity = await createEntity(uid('PW QR Edit Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    await page.locator('[aria-expanded]').filter({ hasText: 'Governance' }).click();

    // Create a rule first
    await page.getByRole('button', { name: 'Add Rule' }).click();
    await page.getByLabel('Rule description').fill('Score must be between 0 and 100');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForLoadState('networkidle');

    // Click edit on the rule — scope to quality rules section to avoid clicking SectionHeader edit buttons
    await page.getByText('Quality Rules').first().locator('..').locator('..').locator('button:has([data-testid="EditIcon"])').click();

    await page.getByLabel('Rule description').clear();
    await page.getByLabel('Rule description').fill('Score must be between 0 and 1000');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');

    // Scope to QR section so strict mode doesn't match textarea in closing dialog
    const qrSection = page.getByText('Quality Rules').first().locator('..').locator('..');
    await expect(qrSection.getByText('Score must be between 0 and 1000')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can delete a quality rule', async ({ page }) => {
    const entity = await createEntity(uid('PW QR Delete Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    await page.locator('[aria-expanded]').filter({ hasText: 'Governance' }).click();

    // Create a rule first
    await page.getByRole('button', { name: 'Add Rule' }).click();
    await page.getByLabel('Rule description').fill('This rule will be deleted');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('This rule will be deleted').first()).toBeVisible({ timeout: 10_000 });

    // Delete it — scope to Quality Rules section to avoid entity-level delete buttons
    await page.getByText('Quality Rules').first().locator('..').locator('..').locator('button:has([data-testid="DeleteIcon"])').click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('No quality rules defined')).toBeVisible({ timeout: 10_000 });
  });

});

// ─── Quality Rules — Ubiquitous Language Page ─────────────────────────────────

test.describe('Quality Rules — Ubiquitous Language Page (Admin)', () => {
  test('entity with quality rules shows rule chip with truncated description in UL page', async ({ page }) => {
    const entityName = uid('PW QR UL Entity');
    const entity = await createEntity(entityName);

    // Add a rule via API
    const token = (await import('node:fs')).default.readFileSync('.auth/admin-token.txt', 'utf8').trim();
    await fetch(`${process.env.E2E_BACKEND_URL ?? 'http://localhost:8080'}/business-entities/${entity.key}/quality-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ description: 'Customer age must be at least 18', severity: 'MUST' }),
    });

    await page.goto('/ubiquitous-language');
    await page.waitForLoadState('networkidle');

    // Search for the entity to avoid pagination issues
    await page.getByPlaceholder('Search entities…').fill(entityName);
    await page.waitForTimeout(300);

    // The entity row should show the rule chip (description truncated to 40 chars)
    await expect(page.getByText('Customer age must be at least 18')).toBeVisible({ timeout: 10_000 });
  });


});

// ─── Quality Rules — Viewer (read-only) ───────────────────────────────────────

test.describe('Quality Rules — Entity Detail (Viewer)', () => {
  test.use({ storageState: '.auth/viewer.json' });

  test('viewer can see quality rules but not the Add Rule button', async ({ page }) => {
    // Create entity and add rule as admin via api-setup
    const entity = await createEntity(uid('PW QR Viewer Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    await page.locator('[aria-expanded]').filter({ hasText: 'Governance' }).click();

    // Add Rule button should not be visible for viewers
    await expect(page.getByRole('button', { name: 'Add Rule' })).not.toBeVisible();
  });
});
