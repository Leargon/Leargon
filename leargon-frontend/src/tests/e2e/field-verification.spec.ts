import { test, expect } from '@playwright/test';
import { uid, OWNER, ADMIN, createEntity } from './api-setup';

// Run as the OWNER so the verification action is available (verification is owner-only).
test.use({ storageState: OWNER });

test.describe('Field Verification', () => {
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
});
