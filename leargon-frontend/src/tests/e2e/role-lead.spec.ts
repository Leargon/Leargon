import { test, expect } from '@playwright/test';
import { uid, createProcess } from './api-setup';

/**
 * Methodology-scoped LEAD (ROLE_LEAD_GDPR) — frontend gating.
 *
 * Acts as the e2e-lead user (created + promoted in auth-roles.setup.ts). Covers the behaviours unique to
 * Layer 2 that are deterministic in the UI:
 *   - a non-admin lead can reach the settings/configuration screens (the cog is gated to admin||lead);
 *   - the methodology configuration screen is filtered to the lead's methodology (GDPR);
 *   - a DDD field is not editable (its card is filtered out entirely).
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

  test('methodology configuration is scoped to GDPR — out-of-scope fields are not editable', async ({ page }) => {
    await page.goto('/settings/methodologies');
    await page.waitForLoadState('networkidle');

    // The GDPR card is shown and its fields can be configured…
    await expect(page.getByText(/GDPR/).first()).toBeVisible();

    // …but out-of-scope methodologies (and therefore their fields) are filtered out entirely:
    // Data Flow (PROCESS_GOVERNANCE) and Bounded Context (DDD) belong to cards the lead can't see.
    await expect(page.getByText('Data Flow')).not.toBeVisible();
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

  test('a GDPR lead does not see structural actions (Delete) on a process they do not own', async ({ page }) => {
    const process = (await createProcess(uid('PW Lead NoDelete'))) as { key: string };
    await page.goto(`/processes/${process.key}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/PW Lead NoDelete/).first()).toBeVisible({ timeout: 10_000 });

    // Delete is gated to owner / steward / admin (broad edit); a methodology-scoped lead must not see it,
    // since the backend rejects deletion by non-owners (avoids an action that would 403).
    await expect(page.getByTestId('delete-process-btn')).not.toBeVisible();
  });
});
