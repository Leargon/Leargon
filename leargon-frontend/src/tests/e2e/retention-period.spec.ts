import { test, expect } from '@playwright/test';
import { uid, createEntity } from './api-setup';

test.describe('Retention Period — Entity Detail', () => {
  let entityKey: string;
  let entityName: string;

  test.beforeEach(async () => {
    entityName = uid('PW RP Entity');
    const entity = await createEntity(entityName);
    entityKey = entity.key as string;
  });

  test('retention period section is visible on entity detail page', async ({ page }) => {
    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Retention Period')).toBeVisible();
    await expect(page.getByText('Not set')).toBeVisible();
  });

  test('admin can set retention period via inline edit', async ({ page }) => {
    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    // Click the edit button next to "Retention Period"
    const retentionSection = page.locator('text=Retention Period').locator('..');
    await retentionSection.locator('button:has([data-testid="EditIcon"])').click();

    const input = page.getByPlaceholder('e.g. 7 years');
    await input.fill('10 years');

    // Save
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByText('10 years')).toBeVisible({ timeout: 5000 });
  });

  test('admin can clear retention period', async ({ page }) => {
    // First set a retention period via the UI
    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    const retentionSection = page.locator('text=Retention Period').locator('..');
    await retentionSection.locator('button:has([data-testid="EditIcon"])').click();

    const input = page.getByPlaceholder('e.g. 7 years');
    await input.fill('3 years');
    await page.locator('button:has([data-testid="CheckIcon"])').click();
    await expect(page.getByText('3 years')).toBeVisible({ timeout: 5000 });

    // Now clear it
    await retentionSection.locator('button:has([data-testid="EditIcon"])').click();
    await input.clear();
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByText('Not set')).toBeVisible({ timeout: 5000 });
  });
});
