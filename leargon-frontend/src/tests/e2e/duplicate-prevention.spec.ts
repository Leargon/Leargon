import { test, expect } from '@playwright/test';
import { uid, createEntity } from './api-setup';

/**
 * Duplicate prevention in the entity wizard: a same-named unplaced entity already exists, so the wizard
 * warns while typing, refuses to create without an acknowledgement and justification, and creates the
 * entity once both are given.
 */
test.describe('Duplicate prevention in the creation wizard', () => {
  test('warns, refuses an unjustified duplicate, then creates it once justified', async ({ page }) => {
    const name = uid('PW Duplicate Customer');
    await createEntity(name);

    await page.goto('/entities');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'New' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name (English)').fill(name);
    await expect(dialog.getByTestId('duplicate-candidates')).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText('Similar items already exist here')).toBeVisible();

    // Without acknowledging, the backend refuses the duplicate.
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog.getByText(/Likely duplicates exist here/)).toBeVisible({ timeout: 10_000 });

    // Acknowledge and justify — then creation goes through.
    await dialog.getByTestId('duplicate-acknowledge').click();
    await dialog.getByTestId('duplicate-justification').fill('A different customer concept with its own lifecycle');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 10_000 });
  });
});
