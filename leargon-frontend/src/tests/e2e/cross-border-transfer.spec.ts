import { test, expect } from '@playwright/test';
import { uid, createProcess, updateCrossBorderTransfers } from './api-setup';

// ─── Process: Cross-border Transfers ────────────────────────────────────────

test.describe('Cross-border Transfers — Process Detail (Admin)', () => {
  test('existing process cross-border transfers are displayed', async ({ page }) => {
    const process = await createProcess(uid('PW CBT Process'));
    const processKey = process.key as string;

    await updateCrossBorderTransfers(
      processKey,
      [{ destinationCountry: 'JP', safeguard: 'BINDING_CORPORATE_RULES' }],
      'processes',
    );

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    // Cross-border transfers are inside the Compliance accordion (collapsed by default for governance perspective)
    await page.locator('[aria-expanded]').filter({ hasText: 'Compliance' }).click();

    await expect(page.getByText('Japan')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Binding Corporate Rules')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can add cross-border transfer to process', async ({ page }) => {
    const process = await createProcess(uid('PW CBT Add Process'));
    const processKey = process.key as string;

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await page.locator('[aria-expanded]').filter({ hasText: 'Compliance' }).click();

    const section = page.locator('text=Cross-border Transfers').first();
    await section.locator('..').getByRole('button').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Country').fill('France');
    await page.getByRole('option', { name: /France/ }).click();

    await dialog.getByRole('combobox').last().click();
    await page.getByRole('option', { name: 'Adequacy Decision' }).click();

    await dialog.getByRole('button', { name: 'Add' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();

    await page.waitForLoadState('networkidle');
    await expect(page.getByText('France')).toBeVisible({ timeout: 10_000 });
  });
});
