import { test, expect, type Page } from '@playwright/test';
import { uid, createOrgUnit, createProcess, createDomain, createBoundedContext, createEntityOwnedBy, ADMIN } from './api-setup';

const backendUrl = (): string => process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';

async function putJson(path: string, body: unknown, stateFile: string): Promise<void> {
  const fs = (await import('node:fs')).default;
  const nodePath = (await import('node:path')).default;
  const tokenFile = stateFile.replace('.json', '-token.txt');
  const absToken = nodePath.join(process.cwd(), tokenFile);
  const token = fs.existsSync(absToken) ? fs.readFileSync(absToken, 'utf8').trim() : '';
  await fetch(`${backendUrl()}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

/**
 * The insights page filters methodology-group sections by the active "view" (role) chosen in the
 * top-bar switcher. The views and what they surface:
 *   - Governance (admin, the default)  → only the Ownership Workload card
 *   - Architecture                     → both the Team Topologies and DDD groups
 *   - Operations                       → Team Topologies group (process load, bottleneck, misplaced)
 *   - DSG / GDPR (compliance)          → nothing (empty-perspective message)
 * The switcher is a top-bar button opening a menu; picking a view persists the preference and
 * navigates to /home, so we return to the insights page afterwards. Its accessible name is the
 * tooltip "Current view" (the visible "Governance"/"Architecture"/… is the button's text content).
 */
async function switchView(page: Page, viewLabel: string): Promise<void> {
  await page.getByRole('button', { name: 'Current view' }).click();
  await page.getByRole('menuitem', { name: viewLabel, exact: true }).click();
  await page.waitForURL('**/home');
  await page.goto('/team-insights');
  await page.waitForLoadState('networkidle');
}

test.describe('Insights page — nav and layout', () => {
  test('Insights nav link is always visible above Help', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');

    const insightsLink = page.getByRole('link', { name: 'Insights' });
    const helpLink = page.getByRole('link', { name: 'Help' });

    await expect(insightsLink).toBeVisible({ timeout: 10_000 });
    await expect(helpLink).toBeVisible({ timeout: 10_000 });

    // Insights should appear above Help in the DOM
    const insightsBox = await insightsLink.boundingBox();
    const helpBox = await helpLink.boundingBox();
    expect(insightsBox!.y).toBeLessThan(helpBox!.y);
  });

  test('the Architecture view shows both methodology groups with cards collapsed by default', async ({ page }) => {
    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');
    // Architecture is the view that surfaces both the Team Topologies and DDD groups.
    await switchView(page, 'Architecture');

    await expect(page.getByText('Team Topologies')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Domain-Driven Design')).toBeVisible({ timeout: 10_000 });

    // A card title is visible in its collapsed accordion summary…
    await expect(page.getByText('Bottleneck Teams')).toBeVisible({ timeout: 10_000 });
    // …while its detail table stays collapsed until expanded.
    await expect(page.getByRole('table').first()).not.toBeVisible();
  });

  test('expanding a card reveals the detail table', async ({ page }) => {
    // Ensure the Ownership Workload table has at least one row (otherwise it renders "no results").
    await createEntityOwnedBy(uid('PW Ownership Entity'));

    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');

    // The default (Governance) view shows the Ownership Workload card.
    await page.getByText('Ownership Workload per User').click();
    // The table header "User" should now be visible
    await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible({ timeout: 10_000 });
  });

  test('the view switcher is visible in the top bar', async ({ page }) => {
    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Current view' })).toBeVisible({ timeout: 10_000 });
  });

  test('the DSG / GDPR (compliance) view hides the methodology groups', async ({ page }) => {
    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');
    await switchView(page, 'DSG / GDPR');

    // No methodology groups for the compliance view…
    await expect(page.getByText('Team Topologies')).not.toBeVisible();
    await expect(page.getByText('Domain-Driven Design')).not.toBeVisible();
    // …and an info message about the empty perspective should appear.
    await expect(page.getByText(/No insights.*perspective/i)).toBeVisible({ timeout: 10_000 });
  });

  test('the Architecture view shows the Team Topologies and DDD groups', async ({ page }) => {
    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');
    await switchView(page, 'Architecture');

    await expect(page.getByText('Team Topologies')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Domain-Driven Design')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Insights page — data', () => {
  test('shows org unit in process load section after assigning a process', async ({ page }) => {
    const orgUnitName = uid('PW Load Team');
    const orgUnit = await createOrgUnit(orgUnitName, ADMIN);
    const process = await createProcess(uid('PW Load Process'), ADMIN);
    await putJson(`/processes/${process.key}/executing-units`, { keys: [orgUnit.key] }, ADMIN);

    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');
    // "Process Load per Org Unit" lives in the Operations view.
    await switchView(page, 'Operations');

    // Expand the Process Load card
    await page.getByText('Process Load per Org Unit').click();
    await expect(page.getByText(orgUnitName)).toBeVisible({ timeout: 15_000 });
  });

  test('shows bottleneck team in TEAM_TOPOLOGIES group with 3+ bounded contexts', async ({ page }) => {
    const orgUnitName = uid('PW BN Team');
    const orgUnit = await createOrgUnit(orgUnitName, ADMIN);
    // A team is a bottleneck when it executes processes spanning >= 3 distinct bounded contexts.
    const d1 = await createDomain(uid('PW BN Dom A'));
    const d2 = await createDomain(uid('PW BN Dom B'));
    const d3 = await createDomain(uid('PW BN Dom C'));
    const bc1 = await createBoundedContext(d1.key as string, uid('PW BN BC A'));
    const bc2 = await createBoundedContext(d2.key as string, uid('PW BN BC B'));
    const bc3 = await createBoundedContext(d3.key as string, uid('PW BN BC C'));
    const p1 = await createProcess(uid('PW BN P1'), ADMIN);
    const p2 = await createProcess(uid('PW BN P2'), ADMIN);
    const p3 = await createProcess(uid('PW BN P3'), ADMIN);

    await putJson(`/processes/${p1.key}/bounded-context`, { boundedContextKey: bc1.key }, ADMIN);
    await putJson(`/processes/${p2.key}/bounded-context`, { boundedContextKey: bc2.key }, ADMIN);
    await putJson(`/processes/${p3.key}/bounded-context`, { boundedContextKey: bc3.key }, ADMIN);
    await putJson(`/processes/${p1.key}/executing-units`, { keys: [orgUnit.key] }, ADMIN);
    await putJson(`/processes/${p2.key}/executing-units`, { keys: [orgUnit.key] }, ADMIN);
    await putJson(`/processes/${p3.key}/executing-units`, { keys: [orgUnit.key] }, ADMIN);

    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');
    // "Bottleneck Teams" is visible in the Operations view.
    await switchView(page, 'Operations');

    // Bottleneck card should be in the TEAM_TOPOLOGIES group; expand it.
    await page.getByText('Bottleneck Teams').click();
    // The unit also appears in the collapsed Process Load / Wrongly Placed cards, so scope to the
    // now-visible (expanded Bottleneck) occurrence.
    await expect(page.getByText(orgUnitName).filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
  });
});
