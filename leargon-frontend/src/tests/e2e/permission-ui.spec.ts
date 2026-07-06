import { test, expect } from '@playwright/test';
import { uid, createEntity } from './api-setup';

// ─── Permission UI ─────────────────────────────────────────────────────────────
//
// Edit affordances in the detail panels now derive from the backend-computed `editableFields`
// (Workstream D). This is the representative UI counterpart to `permission-matrix.integration.test.ts`:
// it only confirms the UI reflects the backend — the exhaustive field-by-field proof lives there.

test.describe('Permission UI — edit affordances follow editableFields', () => {
  // Default project storageState = admin.json (admin owns entities it creates via the API helper).
  test('admin/owner sees field edit controls on an entity', async ({ page }) => {
    const entity = await createEntity(uid('PW Perm Admin Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    // At least one inline-edit pencil is offered to the owner/admin.
    await expect(page.locator('[data-testid="EditIcon"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test.describe('viewer (read-only)', () => {
    test.use({ storageState: '.auth/viewer.json' });

    test('viewer sees no field edit controls on an admin-owned entity', async ({ page }) => {
      // Created by the admin API helper → the viewer is not owner/steward and has no editor role.
      const entity = await createEntity(uid('PW Perm Viewer Entity'));

      await page.goto(`/entities/${entity.key}`);
      await page.waitForLoadState('networkidle');

      // The entity is readable…
      await expect(page).toHaveURL(new RegExp(`/entities/${entity.key}$`));
      // …but no inline-edit pencils are rendered (editableFields is empty for this viewer).
      await expect(page.locator('[data-testid="EditIcon"]')).toHaveCount(0);
    });
  });
});
