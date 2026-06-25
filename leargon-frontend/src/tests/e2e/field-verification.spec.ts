import { test, expect } from '@playwright/test';
import { uid, OWNER, ADMIN, createEntity } from './api-setup';
import fs from 'node:fs';
import path from 'node:path';

const ALL_METHODOLOGY_KEYS = ['DATA_GOVERNANCE', 'PROCESS_GOVERNANCE', 'GDPR', 'DDD', 'BCM', 'TEAM_TOPOLOGIES'];
const GOVERNANCE_KEYS = ['DATA_GOVERNANCE', 'PROCESS_GOVERNANCE', 'DDD', 'TEAM_TOPOLOGIES'];

function adminToken(): string {
  const tokenFile = path.join(process.cwd(), ADMIN.replace('.json', '-token.txt'));
  if (fs.existsSync(tokenFile)) return fs.readFileSync(tokenFile, 'utf8').trim();
  const state = JSON.parse(fs.readFileSync(path.join(process.cwd(), ADMIN), 'utf8')) as {
    origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
  };
  return state.origins?.[0]?.localStorage?.find((i) => i.name === 'auth_token')?.value ?? '';
}

/** Enable per-area verification for exactly `enabledKeys` (admin-only, via the backend API directly). */
async function setVerification(enabledKeys: string[]): Promise<void> {
  const url = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
  const res = await fetch(`${url}/administration/methodology-configurations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken()}` },
    body: JSON.stringify(
      ALL_METHODOLOGY_KEYS.map((key) => ({ key, enabled: true, verificationEnabled: enabledKeys.includes(key) })),
    ),
  });
  if (!res.ok) throw new Error(`PUT methodology-configurations → ${res.status}`);
}

// Run as the OWNER so the verification action is available (verification is owner-only).
test.use({ storageState: OWNER });

test.describe('Field Verification', () => {
  // Serial: the toggle test below mutates the global verification config, so it must not interleave
  // with the indicator tests in this file (kept here, not in methodology-settings, to avoid racing
  // that spec's concurrent worker).
  test.describe.configure({ mode: 'serial' });

  // Deterministically enable verification right before each test rather than relying on the global
  // suite baseline surviving the whole run (other specs mutate the shared methodology config).
  test.beforeEach(async () => {
    await setVerification(GOVERNANCE_KEYS);
  });

  // Safety net: restore the suite baseline (verification on for governance) even if a test bails out
  // mid-toggle, so other concurrent specs that rely on verification being on stay green.
  test.afterAll(async () => {
    await setVerification(GOVERNANCE_KEYS);
  });

  test('owner sees a verification indicator and can change a field status', async ({ page }) => {
    const name = uid('FV Entity');
    const entity = (await createEntity(name, OWNER)) as { key: string };

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    // The owner-created name field shows a verification indicator (an actionable button).
    const indicator = page.getByRole('button', { name: 'Field verification status' }).first();
    await expect(indicator).toBeVisible();

    // Opening it offers the owner the verify/unverify actions; the field starts VERIFIED.
    await indicator.click();
    const markUnverified = page.getByRole('menuitem', { name: 'Mark as unverified' });
    await expect(markUnverified).toBeEnabled();

    // Reset the field to unverified.
    await markUnverified.click();

    // Reopening the menu now offers re-verification.
    await page.getByRole('button', { name: 'Field verification status' }).first().click();
    await expect(page.getByRole('menuitem', { name: 'Mark as verified' })).toBeEnabled();
  });

  // Regression: renaming changes the entity's key (slug). Reverting to a previously-used name reuses
  // its earlier key, whose stale cached snapshot (with the OLD verification status) must NOT be shown.
  // The status is value-independent — only the editor decides it — so a non-owner revert stays UNVERIFIED.
  test('reverting a rename shows the fresh status, not a stale cached one', async ({ browser }) => {
    const nameA = uid('FV Rename A');
    const nameB = uid('FV Rename B');
    const entity = (await createEntity(nameA, OWNER)) as { key: string };

    // Drive the renames as a NON-OWNER admin so each edit drops the field to UNVERIFIED (an owner
    // edit would auto-verify and mask the bug). The owner-created name starts out VERIFIED.
    const adminCtx = await browser.newContext({ storageState: ADMIN });
    const page = await adminCtx.newPage();
    try {
      await page.goto(`/entities/${entity.key}`);
      await page.waitForLoadState('networkidle');

      // The names table is the first table; its read-only indicator starts VERIFIED (check icon).
      const namesTable = page.getByRole('table').first();
      await expect(namesTable.locator('[data-testid="CheckCircleIcon"]')).toBeVisible();

      const rename = async (to: string) => {
        await page.locator('button:has([data-testid="EditIcon"])').first().click();
        const input = page.getByLabel('Name (English)');
        await input.clear();
        await input.fill(to);
        await page.locator('button:has([data-testid="CheckIcon"])').click();
        await expect(page.getByRole('heading', { name: to })).toBeVisible({ timeout: 10_000 });
      };

      await rename(nameB);          // A → B: key changes, field becomes UNVERIFIED
      await rename(nameA);          // B → A: key reverts to the original (previously-cached) key

      // Without a reload, the name must reflect the fresh UNVERIFIED status (warning icon), not the
      // stale VERIFIED snapshot that lived in the cache under the original key.
      const namesTableAfter = page.getByRole('table').first();
      await expect(namesTableAfter.locator('[data-testid="HelpOutlinedIcon"]')).toBeVisible();
      await expect(namesTableAfter.locator('[data-testid="CheckCircleIcon"]')).toHaveCount(0);
    } finally {
      await adminCtx.close();
    }
  });

  test('disabling Data Governance verification hides the indicator; re-enabling restores it', async ({ page }) => {
    const entity = (await createEntity(uid('FV Toggle Entity'), OWNER)) as { key: string };

    // Baseline (verification on): the owner sees the indicator button.
    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Field verification status' }).first()).toBeVisible();

    // Disable verification for Data Governance → indicators gone after a re-fetch.
    await setVerification(GOVERNANCE_KEYS.filter((k) => k !== 'DATA_GOVERNANCE'));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Field verification status' })).toHaveCount(0);

    // Re-enable → indicators return.
    await setVerification(GOVERNANCE_KEYS);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Field verification status' }).first()).toBeVisible({ timeout: 15_000 });
  });
});
