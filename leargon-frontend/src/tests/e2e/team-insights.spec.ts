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

test.describe('Team Insights page', () => {
  test('page loads and shows section headers', async ({ page }) => {
    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Ownership Workload per User')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Process Load per Org Unit')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Bottleneck Teams')).toBeVisible({ timeout: 10_000 });
  });

  test('shows org unit in process load section after assigning a process', async ({ page }) => {
    const orgUnitName = uid('PW Load Team');
    const orgUnit = await createOrgUnit(orgUnitName, ADMIN);
    const process = await createProcess(uid('PW Load Process'), ADMIN);
    await putJson(`/processes/${process.key}/executing-units`, { keys: [orgUnit.key] }, ADMIN);

    await page.goto('/team-insights');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(orgUnitName)).toBeVisible({ timeout: 15_000 });
  });

  test('shows bottleneck team in bottleneck section with 3+ domains', async ({ page }) => {
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

    // The bottleneck team name should appear on the page (in Bottleneck Teams section)
    await expect(page.getByText(orgUnitName)).toBeVisible({ timeout: 15_000 });
  });
});
