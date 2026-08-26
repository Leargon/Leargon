import { test, expect } from '@playwright/test';
import { uid, createEntity, ADMIN } from './api-setup';

const VIEWER_STATE = '.auth/viewer.json';

const backendUrl = (): string => process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';

async function putAsAdmin(path: string, body: unknown): Promise<void> {
  const fs = (await import('node:fs')).default;
  const nodePath = (await import('node:path')).default;
  const abs = nodePath.join(process.cwd(), ADMIN.replace('.json', '-token.txt'));
  const token = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').trim() : '';
  const res = await fetch(`${backendUrl()}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`);
}

/** Makes the English description mandatory, which is the gap these tests navigate and dismiss. */
async function makeDescriptionMandatory(): Promise<void> {
  await putAsAdmin('/administration/field-configurations', [
    { entityType: 'BUSINESS_ENTITY', fieldName: 'descriptions.en', visibility: 'SHOWN', section: 'CORE', maturityLevel: 'BASIC' },
  ]);
}

test.describe('My to-dos', () => {
  let entityName: string;
  let entityKey: string;

  test.beforeAll(async () => {
    await makeDescriptionMandatory();
    entityName = uid('Todo Entity');
    const entity = await createEntity(entityName, ADMIN);
    entityKey = entity.key as string;
  });

  test.afterAll(async () => {
    // These specs mutate app-wide configuration; leave it clean for anything that runs later.
    await putAsAdmin('/administration/field-configurations', []);
    await putAsAdmin('/administration/task-rules', []);
  });

  test('the owner sees the gap on the to-do page and can open the field that fixes it', async ({ page }) => {
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'My to-dos' })).toBeVisible();
    await expect(page.getByText(/^Should do \(/)).toBeVisible({ timeout: 20_000 });
    const row = page.getByRole('button', { name: new RegExp(entityName, 'i') }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    // The row names the field in human terms, not by its storage key.
    await expect(row).toContainText('field: Description (en)');
    await expect(row).not.toContainText('descriptions.en');

    await row.click();
    await page.waitForURL(new RegExp(`/entities/${entityKey}\\?field=descriptions`));
  });

  test('the home page surfaces the same to-dos', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/My to-dos \(/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'View all' })).toBeVisible();
  });

  test('dismissing with a reason moves the to-do out of the way', async ({ page }) => {
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');

    // The list renders only once the derived to-dos arrive, so wait for the group before the row.
    await expect(page.getByText(/^Should do \(/)).toBeVisible({ timeout: 20_000 });
    const row = page.getByRole('button', { name: new RegExp(entityName, 'i') }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'More actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Dismiss' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Reason').fill('Nothing to describe for this entity');
    await page.getByRole('button', { name: 'Dismiss' }).click();

    await expect(page.getByText('Dismissed (1)')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/dismissed: Nothing to describe/)).toBeVisible();
  });

  test('a user who owns nothing sees an empty list', async ({ browser }) => {
    const context = await browser.newContext({ storageState: VIEWER_STATE });
    const page = await context.newPage();

    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Nothing required of you right now.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(new RegExp(entityName, 'i'))).toHaveCount(0);

    await context.close();
  });
});

/**
 * The point of a configurable catalogue: an organisation still building its data landscape can turn a
 * rule off and every owner's list shrinks accordingly.
 */
test.describe('To-do rules configuration', () => {
  test.beforeAll(async () => {
    await makeDescriptionMandatory();
    await createEntity(uid('Rule Entity'), ADMIN);
  });

  test.afterAll(async () => {
    await putAsAdmin('/administration/task-rules', []);
    await putAsAdmin('/administration/field-configurations', []);
  });

  test('an admin can switch a rule off and the matching to-do disappears', async ({ page }) => {
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Fill in a mandatory field').first()).toBeVisible({ timeout: 10_000 });

    await page.goto('/settings/task-rules');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'To-do rules' })).toBeVisible();
    await expect(page.getByText('Essentials')).toBeVisible();

    const ruleRow = page.getByTestId('task-rule-MISSING_MANDATORY_FIELD');
    await expect(ruleRow).toBeVisible({ timeout: 10_000 });
    await ruleRow.getByRole('button', { name: 'Off' }).click();
    await page.waitForLoadState('networkidle');

    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Fill in a mandatory field')).toHaveCount(0);
  });

  test('a preset switches whole tiers at once', async ({ page }) => {
    await page.goto('/settings/task-rules');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Mature' }).click();
    await page.waitForLoadState('networkidle');

    // "Mature" turns everything on, including the expert-tier verification rule.
    const expertRow = page.getByTestId('task-rule-UNVERIFIED_FIELD');
    await expect(expertRow).toBeVisible({ timeout: 10_000 });
    await expect(expertRow.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: 'Starting out' }).click();
    await page.waitForLoadState('networkidle');
    await expect(expertRow.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('a plain user cannot change the rules', async ({ browser }) => {
    const context = await browser.newContext({ storageState: VIEWER_STATE });
    const page = await context.newPage();

    await page.goto('/settings/task-rules');
    await page.waitForLoadState('networkidle');

    // The screen is readable, but every control is locked for someone with no admin or lead role.
    const toggles = page.getByRole('button', { name: 'Should do' });
    const count = await toggles.count();
    for (let i = 0; i < count; i += 1) {
      await expect(toggles.nth(i)).toBeDisabled();
    }
    await expect(page.getByRole('button', { name: 'Starting out' })).toBeDisabled();

    await context.close();
  });
});
