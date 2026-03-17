import { test, expect } from '@playwright/test';
import { uid, createProcess, createEntity, OWNER } from './api-setup';

// ─── DPIA on Process ──────────────────────────────────────────────────────────

test.describe('DPIA — Process Detail (Admin)', () => {
  test('shows "No DPIA recorded" on process without DPIA', async ({ page }) => {
    const process = await createProcess(uid('PW DPIA Process'));
    const processKey = process.key as string;

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Compliance tab
    await page.getByRole('tab', { name: 'Compliance' }).click();

    await expect(page.getByText('No DPIA recorded')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can trigger a DPIA for a process', async ({ page }) => {
    const process = await createProcess(uid('PW DPIA Trigger Process'));
    const processKey = process.key as string;

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Compliance' }).click();

    await page.getByRole('button', { name: 'Trigger DPIA' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('In Progress')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can set risk description on a DPIA', async ({ page }) => {
    const process = await createProcess(uid('PW DPIA Risk Desc Process'));
    const processKey = process.key as string;

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Compliance' }).click();
    await page.getByRole('button', { name: 'Trigger DPIA' }).click();
    await page.waitForLoadState('networkidle');

    // Edit risk description
    await page.locator('button:has([data-testid="EditIcon"])').first().click();
    const textarea = page.locator('textarea').first();
    await textarea.fill('There is a risk of personal data exposure');
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByText('There is a risk of personal data exposure')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can mark a DPIA as completed', async ({ page }) => {
    const process = await createProcess(uid('PW DPIA Complete Process'));
    const processKey = process.key as string;

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Compliance' }).click();
    await page.getByRole('button', { name: 'Trigger DPIA' }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Mark as Completed' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Completed')).toBeVisible({ timeout: 10_000 });
  });
});

// ─── DPIA on Business Entity ──────────────────────────────────────────────────

test.describe('DPIA — Entity Detail (Admin)', () => {
  test('shows "No DPIA recorded" on entity without DPIA', async ({ page }) => {
    const entity = await createEntity(uid('PW DPIA Entity'));
    const entityKey = entity.key as string;

    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    // Entity compliance is the first tab (tab index 0)
    // It should already be visible by default
    await expect(page.getByText('No DPIA recorded')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can trigger a DPIA for an entity', async ({ page }) => {
    const entity = await createEntity(uid('PW DPIA Trigger Entity'));
    const entityKey = entity.key as string;

    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Trigger DPIA' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('In Progress')).toBeVisible({ timeout: 10_000 });
  });
});

// ─── DPIA — Viewer (read-only) ────────────────────────────────────────────────

test.describe('DPIA — Process Detail (Viewer)', () => {
  test.use({ storageState: '.auth/viewer.json' });

  test('viewer cannot see Trigger DPIA button', async ({ page }) => {
    const process = await createProcess(uid('PW DPIA Viewer Process'));
    const processKey = process.key as string;

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Compliance' }).click();

    await expect(page.getByRole('button', { name: 'Trigger DPIA' })).not.toBeVisible();
  });
});
