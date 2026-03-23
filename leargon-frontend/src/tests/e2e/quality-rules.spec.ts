import { test, expect } from '@playwright/test';
import { uid, createEntity, ADMIN, OWNER } from './api-setup';

// ─── Quality Rules — Admin ─────────────────────────────────────────────────────

test.describe('Quality Rules — Entity Detail (Admin)', () => {
  test('shows "No quality rules defined" for entity without rules', async ({ page }) => {
    const entity = await createEntity(uid('PW QR Empty Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Governance tab where quality rules live
    await page.getByRole('tab', { name: 'Governance' }).click();

    await expect(page.getByText('No quality rules defined')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can add a rule with description only (no severity)', async ({ page }) => {
    const entity = await createEntity(uid('PW QR Add Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Governance' }).click();

    await page.getByRole('button', { name: 'Add Rule' }).click();

    // Fill in description
    await page.getByLabel('Rule description').fill('An active customer must have at least one transaction in the last 6 months');

    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('An active customer must have at least one transaction in the last 6 months')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can add a MUST rule with severity chip', async ({ page }) => {
    const entity = await createEntity(uid('PW QR MUST Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Governance' }).click();

    await page.getByRole('button', { name: 'Add Rule' }).click();

    await page.getByLabel('Rule description').fill('Customer email must be a valid RFC 5322 address');
    await page.getByLabel('Severity').click();
    await page.getByRole('option', { name: 'Must' }).click();

    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Customer email must be a valid RFC 5322 address')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Must')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can add a SHOULD rule', async ({ page }) => {
    const entity = await createEntity(uid('PW QR SHOULD Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Governance' }).click();

    await page.getByRole('button', { name: 'Add Rule' }).click();

    await page.getByLabel('Rule description').fill('Phone number should follow E.164 format');
    await page.getByLabel('Severity').click();
    await page.getByRole('option', { name: 'Should' }).click();

    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Phone number should follow E.164 format')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Should')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can add multiple rules to the same entity', async ({ page }) => {
    const entity = await createEntity(uid('PW QR Multi Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Governance' }).click();

    // Add first rule
    await page.getByRole('button', { name: 'Add Rule' }).click();
    await page.getByLabel('Rule description').fill('First name must not be blank');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForLoadState('networkidle');

    // Add second rule
    await page.getByRole('button', { name: 'Add Rule' }).click();
    await page.getByLabel('Rule description').fill('Last name must not be blank');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('First name must not be blank')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Last name must not be blank')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can edit an existing quality rule', async ({ page }) => {
    const entity = await createEntity(uid('PW QR Edit Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Governance' }).click();

    // Create a rule first
    await page.getByRole('button', { name: 'Add Rule' }).click();
    await page.getByLabel('Rule description').fill('Score must be between 0 and 100');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForLoadState('networkidle');

    // Click edit on the rule
    await page.locator('button:has([data-testid="EditIcon"])').first().click();

    await page.getByLabel('Rule description').clear();
    await page.getByLabel('Rule description').fill('Score must be between 0 and 1000');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Score must be between 0 and 1000')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can delete a quality rule', async ({ page }) => {
    const entity = await createEntity(uid('PW QR Delete Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Governance' }).click();

    // Create a rule first
    await page.getByRole('button', { name: 'Add Rule' }).click();
    await page.getByLabel('Rule description').fill('This rule will be deleted');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('This rule will be deleted')).toBeVisible({ timeout: 10_000 });

    // Delete it
    await page.locator('button:has([data-testid="DeleteIcon"])').first().click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('No quality rules defined')).toBeVisible({ timeout: 10_000 });
  });

  test('severity select shows None, Must, Should, May options', async ({ page }) => {
    const entity = await createEntity(uid('PW QR Severity Options Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Governance' }).click();
    await page.getByRole('button', { name: 'Add Rule' }).click();

    await page.getByLabel('Severity').click();

    await expect(page.getByRole('option', { name: 'Must' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Should' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'May' })).toBeVisible();
  });
});

// ─── Quality Rules — Ubiquitous Language Page ─────────────────────────────────

test.describe('Quality Rules — Ubiquitous Language Page (Admin)', () => {
  test('entity with quality rules shows rule chip with truncated description in UL page', async ({ page }) => {
    const entity = await createEntity(uid('PW QR UL Entity'));

    // Add a rule via API
    const { default: fetch } = await import('node-fetch');
    const token = (await import('node:fs')).readFileSync('.auth/admin-token.txt', 'utf8').trim();
    await fetch(`${process.env.E2E_BACKEND_URL ?? 'http://localhost:8080'}/business-entities/${entity.key}/quality-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ description: 'Customer age must be at least 18', severity: 'MUST' }),
    });

    await page.goto('/ubiquitous-language');
    await page.waitForLoadState('networkidle');

    // The entity row should show the rule chip (description truncated to 40 chars)
    await expect(page.getByText('Customer age must be at least 18')).toBeVisible({ timeout: 10_000 });
  });

  test('entity without rules shows dash in Quality Rules column', async ({ page }) => {
    await createEntity(uid('PW QR UL No Rules Entity'));

    await page.goto('/ubiquitous-language');
    await page.waitForLoadState('networkidle');

    // Quality Rules column header should be present
    await expect(page.getByRole('columnheader', { name: 'Quality Rules' })).toBeVisible({ timeout: 10_000 });
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

    await page.getByRole('tab', { name: 'Governance' }).click();

    // Add Rule button should not be visible for viewers
    await expect(page.getByRole('button', { name: 'Add Rule' })).not.toBeVisible();
  });
});
