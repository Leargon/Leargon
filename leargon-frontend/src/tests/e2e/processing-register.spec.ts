import { test, expect, type Page } from '@playwright/test';
import {
  uid,
  createProcess,
  createEntity,
  markEntityPersonalData,
  addProcessInput,
} from './api-setup';

/**
 * The register rows carried an expand chevron that did nothing, because the API only ever sent
 * root processes. These specs pin the drill-down: a sub-process is hidden until its parent is
 * expanded, and collapsing hides it again.
 */
async function seedParentWithChild(): Promise<{ parentName: string; childName: string }> {
  const parentName = uid('E2E Register Parent');
  const childName = uid('E2E Register Child');

  const parent = await createProcess(parentName);
  const child = await createProcess(childName, undefined, parent.key as string);

  // The page filters to personal data by default, so the child needs a real personal-data entity.
  const entity = await createEntity(uid('E2E Register Subject'));
  await markEntityPersonalData(entity.key as string, true, 'DATA_SUBJECT');
  await addProcessInput(child.key as string, entity.key as string);

  return { parentName, childName };
}

const rowByName = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

test.describe('Processing register drill-down', () => {
  test('a sub-process row appears only once its parent is expanded', async ({ page }) => {
    const { parentName, childName } = await seedParentWithChild();

    await page.goto('/compliance');
    await page.waitForLoadState('networkidle');

    const parentRow = rowByName(page, parentName);
    await expect(parentRow).toBeVisible({ timeout: 10_000 });

    // Collapsed: the sub-process is not a row of its own.
    await expect(rowByName(page, childName)).toHaveCount(0);

    // The chevron is the first button in the name cell (the second opens the process).
    await parentRow.getByRole('button').first().click();
    await expect(rowByName(page, childName)).toBeVisible();

    await parentRow.getByRole('button').first().click();
    await expect(rowByName(page, childName)).toHaveCount(0);
  });
});

test.describe('Processing register drill-down (Viewer)', () => {
  test.use({ storageState: '.auth/viewer.json' });

  test('a viewer can expand rows but gets no export button', async ({ page }) => {
    const { parentName, childName } = await seedParentWithChild();

    await page.goto('/compliance');
    await page.waitForLoadState('networkidle');

    const parentRow = rowByName(page, parentName);
    await expect(parentRow).toBeVisible({ timeout: 10_000 });
    await parentRow.getByRole('button').first().click();
    await expect(rowByName(page, childName)).toBeVisible();

    await expect(page.getByRole('button', { name: /export/i })).not.toBeVisible();
  });
});
