import { test, expect } from '@playwright/test';
import { uid, ADMIN, createEntity } from './api-setup';
import fs from 'node:fs';
import path from 'node:path';

function backendUrl(): string {
  return process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
}

function getAdminToken(): string {
  const tokenFile = path.join(process.cwd(), '.auth/admin-token.txt');
  if (fs.existsSync(tokenFile)) return fs.readFileSync(tokenFile, 'utf8').trim();
  const state = JSON.parse(fs.readFileSync(path.join(process.cwd(), ADMIN), 'utf8')) as {
    origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
  };
  return state.origins?.[0]?.localStorage?.find((i) => i.name === 'auth_token')?.value ?? '';
}

async function setFieldConfigurations(entries: Array<{ entityType: string; fieldName: string }>) {
  const res = await fetch(`${backendUrl()}/administration/field-configurations`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken()}`,
    },
    body: JSON.stringify(entries),
  });
  if (!res.ok) throw new Error(`PUT field-configurations → ${res.status}`);
}

async function clearFieldConfigurations() {
  await setFieldConfigurations([]);
}

test.describe('Field Configuration — Admin UI', () => {
  test.afterEach(async () => {
    await clearFieldConfigurations();
  });

  test('field-configurations page is accessible in settings', async ({ page }) => {
    await page.goto('/settings/field-configurations');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Mandatory Field Configuration')).toBeVisible();
  });

  test('can add and save a field configuration', async ({ page }) => {
    await page.goto('/settings/field-configurations');
    await page.waitForLoadState('networkidle');

    // Select entity type and field (labels are now human-readable)
    await page.locator('div[role="combobox"]').first().click();
    await page.getByRole('option', { name: 'Business Entity' }).click();

    await page.locator('div[role="combobox"]').nth(1).click();
    await page.getByRole('option', { name: 'Retention Period' }).click();

    await page.getByRole('button', { name: 'Add' }).click();

    // The chip should appear (a delete icon appears on configured chips)
    await expect(page.locator('[data-testid="DeleteIcon"]')).toBeVisible();

    // Save
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Field configurations saved')).toBeVisible({ timeout: 5000 });
  });

  test('can remove a configured field', async ({ page }) => {
    // Pre-configure a field via API
    await setFieldConfigurations([{ entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod' }]);

    await page.goto('/settings/field-configurations');
    await page.waitForLoadState('networkidle');

    // Chip shows human-readable label; click its delete icon
    await page.locator('[data-testid="DeleteIcon"]').click();

    // Save
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Field configurations saved')).toBeVisible({ timeout: 5000 });

    // Chip should be gone — only the locked "Name (English, default)" chip remains
    await expect(page.locator('[data-testid="DeleteIcon"]')).not.toBeVisible();
  });

  test('shows built-in locked name chip that cannot be removed', async ({ page }) => {
    await page.goto('/settings/field-configurations');
    await page.waitForLoadState('networkidle');

    // The always-required name chip should be visible for each entity type section
    const lockedChips = page.locator('[data-testid="LockIcon"]');
    await expect(lockedChips.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Missing Mandatory Fields — Entity Detail', () => {
  test.afterEach(async () => {
    await clearFieldConfigurations();
  });

  test('shows missing mandatory fields warning on entity detail page (owner view)', async ({ page }) => {
    // Configure retentionPeriod as mandatory
    await setFieldConfigurations([{ entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod' }]);

    const entityName = uid('PW FC Warning Entity');
    const entity = await createEntity(entityName);

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    const banner = page.getByRole('alert');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner.getByText(/mandatory field.*incomplete/i)).toBeVisible();
    await banner.getByRole('button', { name: /show/i }).click();
    await expect(page.getByText(/retentionPeriod/)).toBeVisible();
  });

  test('no warning when all mandatory fields are present', async ({ page }) => {
    // Configure retentionPeriod as mandatory
    await setFieldConfigurations([{ entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod' }]);

    // Create entity and set retention period via API
    const entityName = uid('PW FC Complete Entity');
    const entity = await createEntity(entityName);
    await fetch(`${backendUrl()}/business-entities/${entity.key}/retention-period`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAdminToken()}`,
      },
      body: JSON.stringify({ retentionPeriod: '5 years' }),
    });

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Missing mandatory fields/)).not.toBeVisible();
  });
});

test.describe('Mandatory * Indicator — Section Headers', () => {
  test.afterEach(async () => {
    await clearFieldConfigurations();
  });

  test('shows * on Retention Period section header when configured as mandatory', async ({ page }) => {
    await setFieldConfigurations([{ entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod' }]);

    const entityName = uid('PW Star Indicator Entity');
    const entity = await createEntity(entityName);

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    // The Retention Period section header should contain a * marker
    const retentionSection = page.getByText('Retention Period').first();
    await expect(retentionSection).toBeVisible({ timeout: 5000 });
    // The * is rendered as a sibling Typography element with warning color
    const sectionBox = retentionSection.locator('..').locator('..');
    await expect(sectionBox.getByText('*')).toBeVisible();
  });

  test('Names & Descriptions section always shows * (built-in mandatory)', async ({ page }) => {
    const entityName = uid('PW Always Star Entity');
    const entity = await createEntity(entityName);

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    // Names & Descriptions is always mandatory — should always show *
    const namesSection = page.getByText('Names & Descriptions').first();
    await expect(namesSection).toBeVisible({ timeout: 5000 });
    const sectionBox = namesSection.locator('..').locator('..');
    await expect(sectionBox.getByText('*')).toBeVisible();
  });
});
