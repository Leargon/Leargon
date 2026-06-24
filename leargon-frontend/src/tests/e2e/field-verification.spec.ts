import { test, expect } from '@playwright/test';
import { uid, OWNER, createEntity } from './api-setup';

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
});
