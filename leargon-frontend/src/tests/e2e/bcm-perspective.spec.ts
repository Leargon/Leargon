import { test, expect } from '@playwright/test';
import { uid, createCapability, createOrgUnit, createProcess } from './api-setup';

// ─── BCM Perspective ─────────────────────────────────────────────────────────

test.describe('Default navigation', () => {
  test('admin role view shows Governance label in top nav', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');

    // The role switcher button should show "Governance" for admin
    await expect(page.locator('button').filter({ hasText: /Governance/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('/ redirects to /home by default', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/home/, { timeout: 10_000 });
  });
});

// ─── Capabilities Page ────────────────────────────────────────────────────────

test.describe('Capabilities page', () => {
  test('capabilities page loads without errors', async ({ page }) => {
    await page.goto('/capabilities');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('alert')).not.toBeVisible();
  });

  test('admin can create a capability via UI', async ({ page }) => {
    const name = uid('PW Capability');

    await page.goto('/capabilities');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name (English)').fill(name);
    await dialog.getByRole('button', { name: 'Create' }).click();

    await page.waitForLoadState('networkidle');
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
  });

  test('capability detail shows name and no parent', async ({ page }) => {
    const name = uid('Detail Cap');
    const cap = await createCapability(name);
    const capKey = cap.key as string;

    await page.goto(`/capabilities/${capKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
  });

  test('child capability shows parent name', async ({ page }) => {
    const parentName = uid('Parent Cap');
    const childName = uid('Child Cap');

    const parent = await createCapability(parentName);
    await createCapability(childName, { parentCapabilityKey: parent.key as string });

    // Re-fetch parent to see children
    await page.goto(`/capabilities/${parent.key as string}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(childName).first()).toBeVisible({ timeout: 10_000 });
  });

  test('admin can delete a capability via UI', async ({ page }) => {
    const name = uid('PW Delete Cap');
    const cap = await createCapability(name);
    const capKey = cap.key as string;

    await page.goto(`/capabilities/${capKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await page.waitForLoadState('networkidle');
    await expect(page.getByText(name).first()).not.toBeVisible({ timeout: 10_000 });
  });
});

// ─── Capability Map ────────────────────────────────────────────────────────────

test.describe('Capability Map page', () => {
  test('capability map page loads', async ({ page }) => {
    await page.goto('/diagrams/capability-map');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Capability Map')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('alert')).not.toBeVisible();
  });

  test('capability map shows existing capability', async ({ page }) => {
    const name = uid('MapCap');
    await createCapability(name);

    await page.goto('/diagrams/capability-map');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
  });

  test('clicking capability on map navigates to capability detail', async ({ page }) => {
    const name = uid('ClickMapCap');
    const cap = await createCapability(name);

    await page.goto('/diagrams/capability-map');
    await page.getByText(name).first().click();
    await expect(page.url()).toContain(`/capabilities/${cap.key as string}`);
  });

  test('capability map shows owning unit name on box', async ({ page }) => {
    const unitName = uid('Map Unit');
    const capName = uid('OwnedMapCap');

    const unit = await createOrgUnit(unitName);
    await createCapability(capName, { owningUnitKey: unit.key as string });

    await page.goto('/diagrams/capability-map');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(unitName)).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Strategic Map ─────────────────────────────────────────────────────────────

test.describe('Strategic Map page', () => {
  test('strategic map page loads', async ({ page }) => {
    await page.goto('/diagrams/strategic-map');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Strategic Map')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('alert')).not.toBeVisible();
  });
});

// ─── Perspective Filtering ────────────────────────────────────────────────────

test.describe('Perspective-based field filtering', () => {
  test('admin (governance) perspective on entity detail shows Governance accordion', async ({ page }) => {
    const entityName = uid('PerspEnt');

    // Create entity via API
    const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
    const fs = (await import('node:fs')).default;
    const nodePath = (await import('node:path')).default;
    const tokenFile = nodePath.join(process.cwd(), '.auth/admin-token.txt');
    const token = fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8').trim() : '';
    const r = await fetch(`${backendUrl}/business-entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ names: [{ locale: 'en', text: entityName }] }),
    });
    const entity = (await r.json()) as { key: string };

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    // In admin (governance) perspective, both Governance and Compliance sections are visible
    await expect(page.locator('[aria-expanded]').filter({ hasText: 'Governance' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[aria-expanded]').filter({ hasText: 'Compliance' })).toBeVisible();
  });

  test('switching to compliance role shows Compliance accordion on entity', async ({ page }) => {
    const entityName = uid('GdprPerspEnt');

    const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
    const fs = (await import('node:fs')).default;
    const nodePath = (await import('node:path')).default;
    const tokenFile = nodePath.join(process.cwd(), '.auth/admin-token.txt');
    const token = fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8').trim() : '';
    const r = await fetch(`${backendUrl}/business-entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ names: [{ locale: 'en', text: entityName }] }),
    });
    const entity = (await r.json()) as { key: string };

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    // Switch to DSG/GDPR (compliance) role via the role switcher
    await page.locator('button').filter({ hasText: /Governance/i }).first().click();
    await page.getByRole('menuitem', { name: /DSG.*GDPR/i }).click();
    await page.waitForLoadState('networkidle');

    // Navigate back to the entity
    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    // Compliance accordion should be visible in DSG/GDPR (compliance) perspective
    await expect(page.locator('[aria-expanded]').filter({ hasText: 'Compliance' })).toBeVisible({
      timeout: 10_000,
    });
  });
});
