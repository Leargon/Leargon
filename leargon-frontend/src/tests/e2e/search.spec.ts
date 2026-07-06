import { test, expect } from '@playwright/test';
import { uid, createEntity } from './api-setup';

// ─── Global Search ─────────────────────────────────────────────────────────────

test.describe('Global Search', () => {
  test('finds an entity by name and navigates to its detail page', async ({ page }) => {
    const name = uid('PW Search Entity');
    const entity = await createEntity(name);

    // Start on a page that does NOT list entities, so the only match is the search dropdown.
    await page.goto('/domains');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('Search…').fill(name);

    const result = page.getByText(name, { exact: false }).first();
    await expect(result).toBeVisible({ timeout: 10_000 });

    await result.click();
    await expect(page).toHaveURL(new RegExp(`/entities/${entity.key}$`), { timeout: 10_000 });
  });

  test('a query shorter than 2 chars does not trigger a search/navigation', async ({ page }) => {
    await page.goto('/domains');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('Search…').fill('a');
    // Still on /domains — no navigation, and the box keeps the typed value.
    await expect(page).toHaveURL(/\/domains$/);
    await expect(page.getByPlaceholder('Search…')).toHaveValue('a');
  });
});
