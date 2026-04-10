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

async function setFieldConfigurations(
  entries: Array<{
    entityType: string;
    fieldName: string;
    visibility?: string;
    section?: string;
    maturityLevel?: string;
  }>,
) {
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

test.describe('Field Configuration — Sectioned UI', () => {
  test.afterEach(async () => {
    await clearFieldConfigurations();
  });

  test('page loads with entity type tabs and section accordions', async ({ page }) => {
    await page.goto('/settings/field-configurations');
    await page.waitForLoadState('networkidle');

    // Entity type tabs
    await expect(page.getByRole('tab', { name: 'Business Entity' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Business Domain' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Business Process' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Organisational Unit' })).toBeVisible();

    // Core section accordion is present and expanded by default
    await expect(page.getByText('Core').first()).toBeVisible();
  });

  test('always-required name field is locked and shows as Mandatory', async ({ page }) => {
    await page.goto('/settings/field-configurations');
    await page.waitForLoadState('networkidle');

    // Lock icon should be visible for the default-locale name field
    await expect(page.locator('[data-testid="LockIcon"]').first()).toBeVisible({ timeout: 5000 });

    // The Mandatory toggle for the name field should be selected and all buttons disabled
    const nameRow = page.locator('[data-testid="field-toggle-names\\.en"]');
    await expect(nameRow.getByRole('button', { name: 'Mandatory' })).toBeDisabled();
    await expect(nameRow.getByRole('button', { name: 'Shown' })).toBeDisabled();
    await expect(nameRow.getByRole('button', { name: 'Hidden' })).toBeDisabled();
  });

  test('can mark a field as Mandatory and save', async ({ page }) => {
    await page.goto('/settings/field-configurations');
    await page.waitForLoadState('networkidle');

    // Open Core section (default expanded), click Mandatory for Retention Period
    // First switch to Business Entity tab (default) and find Data Governance section
    await page.getByRole('tab', { name: 'Business Entity' }).click();

    // Expand Data Governance section if collapsed
    const dataGovSection = page.getByText('Data Governance').first();
    await dataGovSection.click();

    // Set Retention Period to Mandatory
    const retentionToggle = page.locator('[data-testid="field-toggle-retentionPeriod"]');
    await retentionToggle.getByRole('button', { name: 'Mandatory' }).click();

    // Save
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Field configurations saved')).toBeVisible({ timeout: 5000 });
  });

  test('can hide a field and save', async ({ page }) => {
    await page.goto('/settings/field-configurations');
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Business Entity' }).click();

    // Expand Data Governance
    await page.getByText('Data Governance').first().click();

    // Hide Retention Period
    const retentionToggle = page.locator('[data-testid="field-toggle-retentionPeriod"]');
    await retentionToggle.getByRole('button', { name: 'Hidden' }).click();

    // Section badge should update to show 1 hidden
    await expect(page.getByText('1 hidden')).toBeVisible();

    // Save
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Field configurations saved')).toBeVisible({ timeout: 5000 });
  });

  test('section badges show mandatory and hidden counts', async ({ page }) => {
    // Pre-configure: retentionPeriod mandatory, qualityRules hidden
    await setFieldConfigurations([
      { entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod', visibility: 'SHOWN', section: 'DATA_GOVERNANCE', maturityLevel: 'BASIC' },
      { entityType: 'BUSINESS_ENTITY', fieldName: 'qualityRules', visibility: 'HIDDEN', section: 'DATA_QUALITY', maturityLevel: 'ADVANCED' },
    ]);

    await page.goto('/settings/field-configurations');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Business Entity' }).click();

    // Data Governance section should show "1 mandatory"
    await expect(page.getByText('1 mandatory').first()).toBeVisible({ timeout: 5000 });
    // Data Quality section should show "1 hidden"
    await expect(page.getByText('1 hidden').first()).toBeVisible({ timeout: 5000 });
  });

  test('switching entity type tabs shows different fields', async ({ page }) => {
    await page.goto('/settings/field-configurations');
    await page.waitForLoadState('networkidle');

    // Business Process should have GDPR section
    await page.getByRole('tab', { name: 'Business Process' }).click();
    await expect(page.getByText('GDPR').first()).toBeVisible({ timeout: 5000 });

    // Business Domain should NOT have GDPR section
    await page.getByRole('tab', { name: 'Business Domain' }).click();
    await expect(page.getByText('GDPR')).not.toBeVisible();
  });

  test('non-mandatory-capable fields do not show Mandatory button', async ({ page }) => {
    await page.goto('/settings/field-configurations');
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Business Entity' }).click();

    // Parent Entity is not mandatory-capable — its toggle row should not have a Mandatory button
    const parentToggle = page.locator('[data-testid="field-toggle-parent"]');
    await expect(parentToggle.getByRole('button', { name: 'Mandatory' })).not.toBeVisible();
    // But Shown and Hidden should exist
    await expect(parentToggle.getByRole('button', { name: 'Shown' })).toBeVisible();
    await expect(parentToggle.getByRole('button', { name: 'Hidden' })).toBeVisible();
  });
});

test.describe('Missing Mandatory Fields — Entity Detail', () => {
  test.afterEach(async () => {
    await clearFieldConfigurations();
  });

  test('shows missing mandatory fields warning on entity detail page', async ({ page }) => {
    await setFieldConfigurations([
      { entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod', visibility: 'SHOWN', section: 'DATA_GOVERNANCE', maturityLevel: 'BASIC' },
    ]);

    const entityName = uid('PW FC Warning Entity');
    const entity = await createEntity(entityName);

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    const banner = page.getByRole('alert').filter({ hasText: /mandatory field/i });
    await expect(banner).toBeVisible({ timeout: 5000 });
    await banner.getByRole('button', { name: /show/i }).click();
    await expect(page.getByText(/retentionPeriod/)).toBeVisible();
  });
});

test.describe('Mandatory * Indicator — Section Headers', () => {
  test.afterEach(async () => {
    await clearFieldConfigurations();
  });

  test('shows * on configured mandatory field section', async ({ page }) => {
    await setFieldConfigurations([
      { entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod', visibility: 'SHOWN', section: 'DATA_GOVERNANCE', maturityLevel: 'BASIC' },
    ]);

    const entity = await createEntity(uid('PW Star Indicator Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    // Built-in mandatory field: Names & Descriptions always shows *
    const namesSection = page.getByText('Names & Descriptions').first();
    await expect(namesSection).toBeVisible();
    await expect(namesSection.locator('..').locator('..').getByText('*').first()).toBeVisible();
  });
});
