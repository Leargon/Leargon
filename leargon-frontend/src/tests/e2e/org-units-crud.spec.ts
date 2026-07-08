import { test, expect } from '@playwright/test';
import { createOrgUnit, setTeamTopologyType, createTeamInteraction, uid, ADMIN } from './api-setup';

// ──────────────────────────────────────────────────────────────────────────────
// Admin tests — uses default project storageState (.auth/admin.json)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Organisational Unit CRUD — Admin', () => {
  let unitKey: string;
  let unitName: string;

  test.beforeEach(async () => {
    unitName = uid('PW OrgUnit');
    const unit = await createOrgUnit(unitName);
    unitKey = unit.key as string;
  });

  test('can create an organisational unit via UI', async ({ page }) => {
    const newName = uid('PW New OrgUnit');

    await page.goto('/organisation');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('dialog').getByLabel('Name (English)').fill(newName);
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('heading', { name: newName })).toBeVisible({ timeout: 10_000 });
  });

  test('can rename an organisational unit', async ({ page }) => {
    const newName = uid('PW Renamed OrgUnit');

    await page.goto(`/organisation/${unitKey}`);
    await page.waitForLoadState('networkidle');

    await page.locator('button:has([data-testid="EditIcon"])').first().click();
    const nameInput = page.getByLabel('Name (English)');
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByRole('heading', { name: newName })).toBeVisible({ timeout: 10_000 });
  });

  test('can delete an organisational unit', async ({ page }) => {
    await page.goto(`/organisation/${unitKey}`);

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).not.toHaveURL(new RegExp(`/organisation/${unitKey}`), { timeout: 10_000 });
  });

  test('shows the Team Interaction Topology view next to Org Chart', async ({ page }) => {
    // Two stream-aligned teams with an interaction → at least two nodes + one edge in the topology.
    const a = await createOrgUnit(uid('PW Topo A'));
    const b = await createOrgUnit(uid('PW Topo B'));
    await setTeamTopologyType(a.key as string, 'STREAM_ALIGNED');
    await setTeamTopologyType(b.key as string, 'PLATFORM');
    await createTeamInteraction(a.key as string, b.key as string, 'X_AS_A_SERVICE', 'ONGOING');

    await page.goto('/organisation');
    await page.waitForLoadState('networkidle');

    // Switch to the Team Interaction Topology view (third toggle next to List / Org Chart).
    await page.getByRole('button', { name: 'Team Interaction Topology' }).click();

    // The diagram renders a node per team; the legend labels the team types.
    await expect(page.getByText('Stream-aligned').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 15_000 });
  });

  test('can edit the mission statement', async ({ page }) => {
    const missionText = uid('Empower stream-aligned teams');

    await page.goto(`/organisation/${unitKey}`);
    await page.waitForLoadState('networkidle');

    const missionHeader = page.getByText('Mission Statement', { exact: true }).locator('..');
    await missionHeader.locator('button:has([data-testid="EditIcon"])').click();

    await page.getByPlaceholder(/purpose and mission/).fill(missionText);
    await missionHeader.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByText(missionText)).toBeVisible({ timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Lead tests — org unit created by owner user, who becomes lead automatically
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Organisational Unit CRUD — Lead', () => {
  test.use({ storageState: '.auth/owner.json' });

  let unitKey: string;

  test.beforeEach(async () => {
    // Root org units require admin. Create as admin with e2eowner as lead.
    const unit = await createOrgUnit(uid('PW Lead OrgUnit'), ADMIN, 'e2eowner');
    unitKey = unit.key as string;
  });

  test('can rename their organisational unit', async ({ page }) => {
    const newName = uid('PW Lead Renamed OrgUnit');

    await page.goto(`/organisation/${unitKey}`);
    await page.waitForLoadState('networkidle');

    await page.locator('button:has([data-testid="EditIcon"])').first().click();
    const nameInput = page.getByLabel('Name (English)');
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByRole('heading', { name: newName })).toBeVisible({ timeout: 10_000 });
  });

  test('can delete their organisational unit', async ({ page }) => {
    await page.goto(`/organisation/${unitKey}`);

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).not.toHaveURL(new RegExp(`/organisation/${unitKey}`), { timeout: 10_000 });
  });

  test('cannot see the New button', async ({ page }) => {
    await page.goto('/organisation');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'New' })).not.toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Viewer tests — plain authenticated user, no ownership
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Organisational Unit CRUD — Viewer', () => {
  test.use({ storageState: '.auth/viewer.json' });

  let unitKey: string;

  test.beforeEach(async () => {
    const unit = await createOrgUnit(uid('PW Viewer OrgUnit'));
    unitKey = unit.key as string;
  });

  test('cannot see edit controls on org unit detail', async ({ page }) => {
    await page.goto(`/organisation/${unitKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button:has([data-testid="EditIcon"])')).not.toBeVisible();
  });

  test('cannot see the Delete button on org unit detail', async ({ page }) => {
    await page.goto(`/organisation/${unitKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible();
  });
});
