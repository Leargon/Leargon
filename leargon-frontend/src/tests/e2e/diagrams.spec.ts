import { test, expect } from '@playwright/test';
import { uid, createEntity, createProcess, createOrgUnit, ADMIN } from './api-setup';

const backendUrl = (): string => process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';

async function postJson(path: string, body: unknown, stateFile: string): Promise<unknown> {
  const fs = (await import('node:fs')).default;
  const nodePath = (await import('node:path')).default;
  const tokenFile = stateFile.replace('.json', '-token.txt');
  const absToken = nodePath.join(process.cwd(), tokenFile);
  const token = fs.existsSync(absToken) ? fs.readFileSync(absToken, 'utf8').trim() : '';
  const r = await fetch(`${backendUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return r.json();
}

test.describe('Entity Map diagram', () => {
  test('page loads with diagram toolbar', async ({ page }) => {
    await page.goto('/diagrams/entities');
    await expect(page.getByText('Entity Relationship Map')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Domain colours')).toBeVisible({ timeout: 10_000 });
  });

  test('shows entity node after entity is created', async ({ page }) => {
    const name = uid('DiagEnt');
    await createEntity(name, ADMIN);

    await page.goto('/diagrams/entities');
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
  });

  test('clicking entity node navigates to entity detail', async ({ page }) => {
    const name = uid('ClickEnt');
    await createEntity(name, ADMIN);

    await page.goto('/diagrams/entities');
    await page.getByText(name).first().click();
    await expect(page.url()).toContain('/entities/');
  });
});

test.describe('Process Landscape diagram', () => {
  test('page loads with diagram toolbar', async ({ page }) => {
    await page.goto('/diagrams/processes');
    await expect(page.getByText('Process Landscape')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Domain colours')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Show entities')).toBeVisible({ timeout: 5_000 });
  });

  test('shows process node after process is created', async ({ page }) => {
    const name = uid('DiagProc');
    await createProcess(name, ADMIN);

    await page.goto('/diagrams/processes');
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
  });

  test('expand all shows child processes', async ({ page }) => {
    const parentName = uid('Parent');
    const childName = uid('Child');
    const parent = (await createProcess(parentName, ADMIN)) as { key: string };
    // Create child directly with parentProcessKey in the request body
    await postJson(
      '/api/processes',
      { names: [{ locale: 'en', text: childName }], parentProcessKey: parent.key },
      ADMIN,
    );

    await page.goto('/diagrams/processes');
    await page.getByText('Expand all').click();
    await expect(page.getByText(childName)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Org Chart diagram', () => {
  test('page loads with org chart toolbar', async ({ page }) => {
    await page.goto('/diagrams/organisation');
    await expect(page.getByText('Organisation Chart')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Process count')).toBeVisible({ timeout: 10_000 });
  });

  test('shows org unit node after org unit is created', async ({ page }) => {
    const name = uid('DiagUnit');
    await createOrgUnit(name, ADMIN);

    await page.goto('/diagrams/organisation');
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
  });

  test('clicking org unit node navigates to org unit detail', async ({ page }) => {
    const name = uid('ClickUnit');
    const unit = (await createOrgUnit(name, ADMIN)) as { key: string };

    await page.goto('/diagrams/organisation');
    await page.getByText(name).first().click();
    await expect(page.url()).toContain(`/organisation/${unit.key}`);
  });
});

test.describe('Entity Lineage tab', () => {
  test('lineage tab appears on entity detail', async ({ page }) => {
    const name = uid('LineageEnt');
    const entity = (await createEntity(name, ADMIN)) as { key: string };

    await page.goto(`/entities/${entity.key}`);
    await expect(page.getByRole('tab', { name: 'Data Lineage' })).toBeVisible({ timeout: 10_000 });
  });

  test('lineage diagram shows linked process', async ({ page }) => {
    const entityName = uid('LineEnt');
    const procName = uid('LineProc');
    const entity = (await createEntity(entityName, ADMIN)) as { key: string };
    const proc = (await createProcess(procName, ADMIN)) as { key: string };
    await postJson(`/api/processes/${proc.key}/inputs`, { entityKey: entity.key }, ADMIN);

    await page.goto(`/entities/${entity.key}`);
    await page.getByRole('tab', { name: 'Data Lineage' }).click();
    await expect(page.getByText(procName)).toBeVisible({ timeout: 15_000 });
  });
});
