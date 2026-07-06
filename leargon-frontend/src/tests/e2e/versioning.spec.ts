import { test, expect } from '@playwright/test';
import { uid, createEntity } from './api-setup';

// ─── Version History ───────────────────────────────────────────────────────────

test.describe('Version History', () => {
  test('an entity exposes its version history with a CREATE entry', async ({ page }) => {
    const entity = await createEntity(uid('PW Version Entity'));

    await page.goto(`/entities/${entity.key}`);
    await page.waitForLoadState('networkidle');

    // Version history lives inside the collapsed "Governance" accordion — expand it first.
    await page.getByRole('button', { name: 'Governance' }).click();

    // Expand the Version History section.
    await page.getByText(/Version History \(/).click();

    // The creation of the entity is recorded as a CREATE version.
    await expect(page.getByText('CREATE').first()).toBeVisible({ timeout: 10_000 });
  });
});
