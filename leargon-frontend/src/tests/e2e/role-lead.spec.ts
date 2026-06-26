import { test, expect } from '@playwright/test';
import { uid, createProcess } from './api-setup';

/**
 * Methodology-scoped LEAD (ROLE_LEAD_GDPR) — frontend gating.
 *
 * Acts as the e2e-lead user (created + promoted in auth-roles.setup.ts). Covers the behaviours unique to
 * Layer 2 that are deterministic in the UI:
 *   - a non-admin lead can reach the settings/configuration screens (the cog is gated to admin||lead);
 *   - the methodology + field-configuration screens are filtered to the lead's methodology (GDPR);
 *   - a DDD field is not editable (its section/card is filtered out entirely).
 * The content-edit → UNVERIFIED + verify-403 behaviour is asserted end-to-end in the role-permissions
 * integration suite (API level), which is more robust than driving the inline editors here.
 */
test.use({ storageState: '.auth/lead-gdpr.json' });

test.describe('LEAD_GDPR scoped configuration access', () => {
  test('methodology configuration is filtered to GDPR only', async ({ page }) => {
    await page.goto('/settings/methodologies');
    await page.waitForLoadState('networkidle');

    // The lead's own methodology card is shown…
    await expect(page.getByText(/GDPR/).first()).toBeVisible();
    // …but methodologies they don't lead are not.
    await expect(page.getByText('Domain-Driven Design')).not.toBeVisible();
    await expect(page.getByText('Business Capability Model')).not.toBeVisible();
    await expect(page.getByText('Team Topologies')).not.toBeVisible();
  });

  test('field configuration shows the GDPR section on processes but not out-of-scope sections', async ({ page }) => {
    await page.goto('/settings/field-configurations');
    await page.waitForLoadState('networkidle');

    // Business Process carries the GDPR section — visible to a GDPR lead.
    await page.getByRole('tab', { name: 'Business Process' }).click();
    await expect(page.getByText('GDPR', { exact: true }).first()).toBeVisible({ timeout: 5000 });
    // Data Flow (PROCESS_GOVERNANCE) is out of scope for a GDPR lead — not shown.
    await expect(page.getByText('Data Flow')).not.toBeVisible();

    // Business Entity has no GDPR-owned section, so a GDPR lead sees no editable sections there.
    await page.getByRole('tab', { name: 'Business Entity' }).click();
    await expect(page.getByText('Data Governance')).not.toBeVisible();
    // A DDD field (Bounded Context lives in the DDD section) is therefore not editable.
    await expect(page.getByText('Bounded Context')).not.toBeVisible();
  });

  test('a lead can open a process detail page (content access works)', async ({ page }) => {
    const process = (await createProcess(uid('PW Lead Process'))) as { key: string };
    await page.goto(`/processes/${process.key}`);
    await page.waitForLoadState('networkidle');

    // Not redirected away — the process detail renders.
    await expect(page).toHaveURL(new RegExp(`/processes/${process.key}`));
    await expect(page.getByText(/PW Lead Process/).first()).toBeVisible({ timeout: 10_000 });
  });
});
