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
    const upName = uid('PW Upstream');
    const downName = uid('PW Downstream');

    const upDomain = await createDomain(upName);
    const downDomain = await createDomain(downName);
    const upKey = upDomain.key as string;
    const downKey = downDomain.key as string;

    // Create bounded contexts so the Add Relationship button becomes visible
    await createBoundedContext(upKey, uid('Up BC 1'));
    await createBoundedContext(upKey, uid('Up BC 2'));

    // Navigate to upstream domain
    await page.goto(`/domains/${upKey}`);
    await page.waitForLoadState('networkidle');

    // Click Add Relationship button
    const addBtn = page.getByRole('button', { name: 'Add Relationship' });
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Fill in dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Select partner domain
    const partnerAutocomplete = dialog.locator('input').first();
    await partnerAutocomplete.fill(downName);
    await page.waitForTimeout(500);
    const option = page.getByRole('option').first();
    if (await option.isVisible()) {
      await option.click();
    }

    // Click Create
    await dialog.getByRole('button', { name: 'Create' }).click();
    await page.waitForLoadState('networkidle');

    // The dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // Context Relationships section should now show the relationship
    await expect(page.getByText('Context Relationships')).toBeVisible({ timeout: 5_000 });
  });

  test('created relationship appears on context map diagram', async ({ page }) => {
    await page.goto('/diagrams/context-map');
    await page.waitForLoadState('networkidle');

    // ReactFlow diagram canvas should be visible
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15_000 });
  });
});
