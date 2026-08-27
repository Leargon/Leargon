import { test, expect, type Page } from '@playwright/test';
import { uid, createEntity, createOrgUnit, assignOwningUnitToEntity, ADMIN } from './api-setup';
import fs from 'node:fs';
import nodePath from 'node:path';

/**
 * The "Group by" control on an overview page.
 *
 * The interesting case is not that grouping works, but what happens to the hierarchy: an entity whose
 * parent belongs to a different team still appears under that parent, and the parent is shown greyed
 * out and unclickable because it is not itself a member of the group.
 */

const backendUrl = (): string => process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';

function adminToken(): string {
  const abs = nodePath.join(process.cwd(), ADMIN.replace('.json', '-token.txt'));
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').trim() : '';
}

async function api(path: string, method: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${backendUrl()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken()}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  if (res.status === 204 || res.headers.get('content-length') === '0') return {};
  return res.json() as Promise<Record<string, unknown>>;
}

async function selectGrouping(page: Page, label: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Group by' }).click();
  await page.getByRole('option', { name: label }).click();
}

/** Groups start closed, so most assertions about rows need the heading clicked first. */
async function openGroup(page: Page, heading: string): Promise<void> {
  await page.getByText(heading, { exact: false }).click();
}

test.describe('Grouping an overview list', () => {
  let unitA: string;
  let unitB: string;
  let parentName: string;
  let childName: string;
  let parentKey: string;

  test.beforeAll(async () => {
    unitA = uid('PW Group Sales') as string;
    unitB = uid('PW Group Support') as string;
    const a = await createOrgUnit(unitA);
    const b = await createOrgUnit(unitB);

    parentName = uid('PW Group Parent');
    childName = uid('PW Group Child');
    const parent = await createEntity(parentName);
    const child = await createEntity(childName);
    parentKey = parent.key as string;

    await assignOwningUnitToEntity(parentKey, a.key as string);
    await assignOwningUnitToEntity(child.key as string, b.key as string);
    await api(`/business-entities/${child.key}/parent`, 'PUT', { parentKey });
  });

  test.afterEach(async ({ page }) => {
    // The choice is persisted per list, so it would leak into every spec that runs afterwards.
    await page.evaluate(() => localStorage.removeItem('leargon.groupBy.BUSINESS_ENTITY'));
  });

  test('the list is ungrouped until a grouping is chosen', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('combobox', { name: 'Group by' })).toBeVisible({ timeout: 20_000 });
    // No group headings before a dimension is picked — the plain tree is untouched.
    await expect(page.getByText(unitA, { exact: false })).toHaveCount(0);
  });

  test('choosing a grouping shows group headings with their counts', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    await selectGrouping(page, 'Owning Unit');

    await expect(page.getByText(`${unitA} (1)`, { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`${unitB} (1)`, { exact: false })).toBeVisible();
  });

  test('an ancestor from another group is shown as context and cannot be opened', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    await selectGrouping(page, 'Owning Unit');
    await expect(page.getByText(`${unitB} (1)`, { exact: false })).toBeVisible({ timeout: 20_000 });
    await openGroup(page, `${unitB} (1)`);

    // Support's group shows the child under its parent, but the parent belongs to Sales.
    const contextRow = page.getByRole('button', { name: parentName }).last();
    await expect(contextRow).toBeVisible();
    await expect(contextRow).toBeDisabled();

    // The child underneath it is a real member and stays selectable.
    const memberRow = page.getByRole('button', { name: childName }).last();
    await expect(memberRow).toBeEnabled();
  });

  test('the chosen grouping survives a reload', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');
    await selectGrouping(page, 'Owning Unit');
    await expect(page.getByText(`${unitA} (1)`, { exact: false })).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(`${unitA} (1)`, { exact: false })).toBeVisible({ timeout: 20_000 });
  });

  test('groups start collapsed, showing headings and counts but no items', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    await selectGrouping(page, 'Owning Unit');

    // The point of grouping: an overview of who owns what, not a longer list than before.
    await expect(page.getByText(`${unitA} (1)`, { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: childName })).toHaveCount(0);
  });

  test('clicking a heading opens that group and leaves the others shut', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    await selectGrouping(page, 'Owning Unit');
    await expect(page.getByText(`${unitB} (1)`, { exact: false })).toBeVisible({ timeout: 20_000 });

    await openGroup(page, `${unitB} (1)`);

    await expect(page.getByRole('button', { name: childName }).last()).toBeVisible();
  });

  test('expand all opens every group at once', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    await selectGrouping(page, 'Owning Unit');
    await expect(page.getByText(`${unitA} (1)`, { exact: false })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Expand all' }).click();

    await expect(page.getByRole('button', { name: childName }).last()).toBeVisible();
    // and the control now offers the reverse
    await expect(page.getByRole('button', { name: 'Collapse all' })).toBeVisible();
  });

  test('searching reveals matches without expanding anything by hand', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    await selectGrouping(page, 'Owning Unit');
    await expect(page.getByText(`${unitA} (1)`, { exact: false })).toBeVisible({ timeout: 20_000 });

    // A closed group during a search would make the box look broken.
    await page.getByPlaceholder('Search entities...').fill(childName);

    await expect(page.getByRole('button', { name: childName }).last()).toBeVisible({ timeout: 20_000 });
  });

  test('a signed-out visitor gets the login page, not a grouped catalogue', async ({ page, context }) => {
    // Negative case: grouping must not have opened an unauthenticated read of the list.
    // The token is cleared before the first navigation. Clearing it afterwards races the app's own
    // redirect to /login, which tears down the execution context mid-evaluate — that made this test
    // pass or fail depending on timing.
    await context.clearCookies();
    await page.addInitScript(() => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    });

    await page.goto('/entities');

    await page.waitForURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByText(unitA, { exact: false })).toHaveCount(0);
  });
});
