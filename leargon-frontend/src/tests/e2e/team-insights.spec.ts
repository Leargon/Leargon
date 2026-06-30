import { test, expect } from '@playwright/test';
import { uid, createOrgUnit, createProcess, createDomain, ADMIN } from './api-setup';

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

  test('page loads with methodology groups and cards collapsed by default', async ({ page }) => {
    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');

    // Group headers for the enabled methodologies should be present
    await expect(page.getByText('Team Topologies')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Domain-Driven Design')).toBeVisible({ timeout: 10_000 });

    // Cards should exist (title text visible in collapsed accordion summary)
    await expect(page.getByText('Ownership Workload per User')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Process Load per Org Unit')).toBeVisible({ timeout: 10_000 });
  });

  test('expanding a card reveals the detail table', async ({ page }) => {
    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');

    // Click the "Ownership Workload per User" card to expand it
    await page.getByText('Ownership Workload per User').click();
    // The table header "User" should now be visible
    await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible({ timeout: 10_000 });
  });

  test('perspective switcher is visible on the Insights page', async ({ page }) => {
    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');

    // The perspective selector should be in the top bar
    await expect(page.getByRole('combobox').filter({ hasText: /All|Architecture|Compliance|Governance/ }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('selecting Compliance perspective hides TEAM_TOPOLOGIES and DDD groups', async ({ page }) => {
    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');

    // Switch to Compliance perspective
    const perspectivePicker = page.getByRole('combobox').filter({ hasText: /All|Architecture|Compliance|Governance/ }).first();
    await perspectivePicker.click();
    await page.getByRole('option', { name: 'Compliance' }).click();
    await page.waitForLoadState('networkidle');

    // TEAM_TOPOLOGIES and DDD groups should not be visible
    await expect(page.getByText('Team Topologies')).not.toBeVisible();
    await expect(page.getByText('Domain-Driven Design')).not.toBeVisible();

    // An info message about the empty perspective should appear
    await expect(page.getByText(/No insights.*perspective/i)).toBeVisible({ timeout: 10_000 });
  });

  test('selecting Architecture perspective shows only TEAM_TOPOLOGIES and DDD groups', async ({ page }) => {
    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');

    const perspectivePicker = page.getByRole('combobox').filter({ hasText: /All|Architecture|Compliance|Governance/ }).first();
    await perspectivePicker.click();
    await page.getByRole('option', { name: 'Architecture' }).click();
    await page.waitForLoadState('networkidle');

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

    // Expand the Process Load card
    await page.getByText('Process Load per Org Unit').click();
    await expect(page.getByText(orgUnitName)).toBeVisible({ timeout: 15_000 });
  });

  test('shows bottleneck team in TEAM_TOPOLOGIES group with 3+ domains', async ({ page }) => {
    const orgUnitName = uid('PW BN Team');
    const orgUnit = await createOrgUnit(orgUnitName, ADMIN);
    const domain1 = await createDomain(uid('PW BN Dom A'));
    const domain2 = await createDomain(uid('PW BN Dom B'));
    const domain3 = await createDomain(uid('PW BN Dom C'));
    const p1 = await createProcess(uid('PW BN P1'), ADMIN);
    const p2 = await createProcess(uid('PW BN P2'), ADMIN);
    const p3 = await createProcess(uid('PW BN P3'), ADMIN);

    await putJson(`/processes/${p1.key}/domain`, { businessDomainKey: domain1.key }, ADMIN);
    await putJson(`/processes/${p2.key}/domain`, { businessDomainKey: domain2.key }, ADMIN);
    await putJson(`/processes/${p3.key}/domain`, { businessDomainKey: domain3.key }, ADMIN);
    await putJson(`/processes/${p1.key}/executing-units`, { keys: [orgUnit.key] }, ADMIN);
    await putJson(`/processes/${p2.key}/executing-units`, { keys: [orgUnit.key] }, ADMIN);
    await putJson(`/processes/${p3.key}/executing-units`, { keys: [orgUnit.key] }, ADMIN);

    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');

    // Bottleneck card should be in the TEAM_TOPOLOGIES group; expand it
    await page.getByText('Bottleneck Teams').click();
    await expect(page.getByText(orgUnitName)).toBeVisible({ timeout: 15_000 });
  });
});
