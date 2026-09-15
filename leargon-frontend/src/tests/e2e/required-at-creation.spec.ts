import { test, expect } from '@playwright/test';
import { apiStatus, uid, ADMIN } from './api-setup';

/**
 * "Required at creation" (runs in its own serial Playwright phase, because it changes the app-wide field
 * configuration): the English entity description is made mandatory and required at creation.
 *  - the settings screen shows the ticked "Required at creation" checkbox for that field;
 *  - the entity wizard tells the user up front, and refuses to create without the field (422 → message).
 */
const REQUIRED_DESCRIPTION = [
  {
    entityType: 'BUSINESS_ENTITY',
    fieldName: 'descriptions.en',
    visibility: 'SHOWN',
    section: 'CORE',
    maturityLevel: 'BASIC',
    requiredAtCreation: true,
  },
];

test.describe('Required at creation', () => {
  test.beforeAll(async () => {
    expect(await apiStatus('/administration/field-configurations', 'PUT', REQUIRED_DESCRIPTION, ADMIN)).toBe(200);
  });

  test.afterAll(async () => {
    // Leave the app-wide configuration clean for anything that runs later.
    await apiStatus('/administration/field-configurations', 'PUT', [], ADMIN);
  });

  test('the settings screen shows the field as required at creation', async ({ page }) => {
    await page.goto('/settings/methodologies');
    await page.waitForLoadState('networkidle');

    // Only one methodology card is expanded at a time; entity descriptions belong to Data Governance, the first card.
    await expect(page.getByRole('heading', { name: 'Data Governance', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Configure' }).first().click();

    const checkbox = page.getByTestId('required-at-creation-descriptions.en').locator('input');
    await expect(checkbox).toBeChecked({ timeout: 10_000 });
  });

  test('the entity wizard announces the requirement and refuses to create without it', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('required-at-creation-hint')).toBeVisible({ timeout: 10_000 });

    await dialog.getByRole('textbox').first().fill(uid('PW Required Missing'));
    // Guided mode offers Create on the last step only.
    const create = dialog.getByRole('button', { name: 'Create', exact: true });
    for (let i = 0; i < 10 && !(await create.isVisible()); i++) {
      await dialog.getByRole('button', { name: 'Next' }).click();
    }
    await create.click();

    await expect(dialog.getByText(/Please fill in the fields required at creation/)).toBeVisible({ timeout: 10_000 });
    // Nothing was created — the dialog is still open.
    await expect(dialog).toBeVisible();
  });
});
