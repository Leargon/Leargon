import { test, expect } from '@playwright/test';
import { ADMIN } from './api-setup';
import fs from 'node:fs';
import path from 'node:path';

const ALL_METHODOLOGY_KEYS = ['DATA_GOVERNANCE', 'PROCESS_GOVERNANCE', 'GDPR', 'DDD', 'BCM', 'TEAM_TOPOLOGIES'];
const GOVERNANCE_KEYS = ['DATA_GOVERNANCE', 'PROCESS_GOVERNANCE', 'DDD', 'TEAM_TOPOLOGIES'];

function backendUrl(): string {
  return process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
}

function getAdminToken(): string {
  const tokenFile = path.join(process.cwd(), ADMIN.replace('.json', '-token.txt'));
  if (fs.existsSync(tokenFile)) return fs.readFileSync(tokenFile, 'utf8').trim();
  const state = JSON.parse(fs.readFileSync(path.join(process.cwd(), ADMIN), 'utf8')) as {
    origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
  };
  return state.origins?.[0]?.localStorage?.find((i) => i.name === 'auth_token')?.value ?? '';
}

async function setMethodologies(
  entries: Array<{ key: string; enabled: boolean; verificationEnabled?: boolean }>,
): Promise<void> {
  // Default verification to the suite baseline (on for governance) unless a test overrides it, so
  // methodology-enablement tests don't inadvertently turn verification off for concurrent specs.
  const body = entries.map((e) => ({ verificationEnabled: GOVERNANCE_KEYS.includes(e.key), ...e }));
  const res = await fetch(`${backendUrl()}/administration/methodology-configurations`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT methodology-configurations → ${res.status}`);
}

async function resetMethodologies(): Promise<void> {
  // Restore the suite baseline: all methodologies enabled, verification on for governance areas
  // (matches auth.setup), so concurrent specs that rely on verification being on stay green.
  await setMethodologies(
    ALL_METHODOLOGY_KEYS.map((key) => ({ key, enabled: true, verificationEnabled: GOVERNANCE_KEYS.includes(key) })),
  );
}

test.use({ storageState: ADMIN });

test.describe('Methodology Settings', () => {
  test.afterEach(async () => {
    await resetMethodologies();
  });

  test('settings page shows all 6 methodology cards enabled by default', async ({ page }) => {
    await page.goto('/settings/methodologies');
    await page.waitForLoadState('networkidle');

    // Use .first() because methodology labels also appear in section chips on sibling cards
    await expect(page.getByText('Data Governance').first()).toBeVisible();
    await expect(page.getByText('Process Governance').first()).toBeVisible();
    await expect(page.getByText('GDPR / DSG — Legal & Privacy').first()).toBeVisible();
    await expect(page.getByText('Domain-Driven Design').first()).toBeVisible();
    await expect(page.getByText('Business Capability Model').first()).toBeVisible();
    await expect(page.getByText('Team Topologies').first()).toBeVisible();

    // All 6 methodology switches should be present
    const switches = page.locator('input[type="checkbox"][role="checkbox"], input[type="checkbox"]');
    const count = await switches.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('disabling DDD hides DDD nav items from sidebar', async ({ page }) => {
    await setMethodologies([
      { key: 'DDD', enabled: false },
      ...['DATA_GOVERNANCE', 'PROCESS_GOVERNANCE', 'GDPR', 'BCM', 'TEAM_TOPOLOGIES'].map((k) => ({ key: k, enabled: true })),
    ]);

    // Navigate to architecture perspective where DDD items appear
    await page.goto('/domains');
    await page.waitForLoadState('networkidle');

    // DDD nav items should not be visible
    await expect(page.getByRole('button', { name: 'Ubiquitous Language' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Context Map' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Event Flow' })).not.toBeVisible();
  });

  test('re-enabling DDD restores DDD nav items in sidebar', async ({ page }) => {
    // First disable
    await setMethodologies(
      ALL_METHODOLOGY_KEYS.map((k) => ({ key: k, enabled: k !== 'DDD' })),
    );

    await page.goto('/domains');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Context Map' })).not.toBeVisible();

    // Re-enable
    await setMethodologies(ALL_METHODOLOGY_KEYS.map((k) => ({ key: k, enabled: true })));

    // Navigate away and back to ensure fresh methodology config fetch
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.goto('/domains');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Context Map' })).toBeVisible({ timeout: 15_000 });
  });

  test('disabling GDPR hides compliance nav items for admin', async ({ page }) => {
    await setMethodologies(
      ALL_METHODOLOGY_KEYS.map((k) => ({ key: k, enabled: k !== 'GDPR' })),
    );

    await page.goto('/domains');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Processing Register' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'DPIA Register' })).not.toBeVisible();
  });

  test('disabling GDPR hides IT Systems and Service Providers nav items', async ({ page }) => {
    await setMethodologies(
      ALL_METHODOLOGY_KEYS.map((k) => ({ key: k, enabled: k !== 'GDPR' })),
    );

    await page.goto('/domains');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'IT Systems' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Service Providers' })).not.toBeVisible();
  });

  test('disabling BCM hides Capabilities and Team Insights nav items', async ({ page }) => {
    await setMethodologies(
      ALL_METHODOLOGY_KEYS.map((k) => ({ key: k, enabled: k !== 'BCM' })),
    );

    await page.goto('/domains');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Capabilities' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Team Insights' })).not.toBeVisible();
  });

  test('toggling a methodology off via UI disables it', async ({ page }) => {
    await page.goto('/settings/methodologies');
    await page.waitForLoadState('networkidle');

    // Find the DDD card and click its methodology-enabled switch (the first toggle; governance cards
    // also have a second "Field verification" switch) to disable.
    const dddCard = page.locator('.MuiCard-root').filter({ hasText: 'Domain-Driven Design' });
    const dddSwitch = dddCard.locator('input[type="checkbox"]').first();
    await expect(dddSwitch).toBeChecked();
    await dddSwitch.click({ force: true });

    // Wait for the API call to complete
    await page.waitForLoadState('networkidle');

    // Switch should now be unchecked
    await expect(dddSwitch).not.toBeChecked();
  });

  // NOTE: the verification on/off → entity-indicator behaviour is covered by field-verification.spec
  // (kept there so it runs serially with the other verification tests and can't race this spec's
  // concurrent worker over the global methodology config). Integration + backend specs cover it too.

  test('methodology settings link appears in settings sidebar', async ({ page }) => {
    await page.goto('/settings/users');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('link', { name: 'Methodologies' })).toBeVisible();
  });
});
