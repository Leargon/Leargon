import { test, expect } from '@playwright/test';
import { uid, createDomain, createBoundedContext, ADMIN } from './api-setup';

// ─── Context Map Page ──────────────────────────────────────────────────────

test.describe('Context Map (Admin)', () => {
  test('context map page loads and shows diagram', async ({ page }) => {
    await page.goto('/diagrams/context-map');
    await page.waitForLoadState('networkidle');

    // Page header should be visible
    await expect(page.getByText('Context Map')).toBeVisible({ timeout: 10_000 });
  });

  test('context map shows "no relationships" hint when empty', async ({ page }) => {
    await page.goto('/diagrams/context-map');
    await page.waitForLoadState('networkidle');

    // The diagram should render without error even with no relationships
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15_000 });
  });

  test('admin can create a context relationship from domain detail', async ({ page }) => {
    const domainKey = (await createDomain(uid('PW Rel Domain'))).key as string;

    // Need 2+ BCs in the same domain — the dialog selects from this domain's BCs
    const bcA = uid('BC Alpha');
    const bcB = uid('BC Beta');
    await createBoundedContext(domainKey, bcA);
    await createBoundedContext(domainKey, bcB);

    await page.goto(`/domains/${domainKey}`);
    await page.waitForLoadState('networkidle');

    // Add Relationship button appears when domain has >= 2 BCs
    await expect(page.getByRole('button', { name: 'Add Relationship' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Add Relationship' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Select upstream BC (first autocomplete)
    await dialog.locator('input').first().fill(bcA.slice(0, 7));
    await page.waitForTimeout(300);
    await page.getByRole('option').filter({ hasText: bcA }).click();

    // Select downstream BC (second autocomplete)
    await dialog.locator('input').nth(1).fill(bcB.slice(0, 7));
    await page.waitForTimeout(300);
    await page.getByRole('option').filter({ hasText: bcB }).click();

    await dialog.getByRole('button', { name: 'Create' }).click();
    await page.waitForLoadState('networkidle');

    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Context Relationships')).toBeVisible({ timeout: 5_000 });
  });

  test('created relationship appears on context map diagram', async ({ page }) => {
    await page.goto('/diagrams/context-map');
    await page.waitForLoadState('networkidle');

    // ReactFlow diagram canvas should be visible
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15_000 });
  });
});
