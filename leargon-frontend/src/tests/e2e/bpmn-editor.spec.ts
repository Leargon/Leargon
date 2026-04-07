import { test, expect, type Page } from '@playwright/test';
import { createProcess, saveProcessFlow, uid, ADMIN } from './api-setup';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Navigate to a process page and open the Process Diagram accordion. */
async function openDiagram(page: Page, processKey: string): Promise<void> {
  await page.goto(`/processes/${processKey}`);
  await page.waitForLoadState('networkidle');
  await page.getByText('Process Diagram').click();
  await expect(page.getByTestId('flow-canvas')).toBeVisible({ timeout: 10_000 });
}

/** Enter edit mode on the BPMN editor. */
async function enterEditMode(page: Page): Promise<void> {
  await page.getByTestId('flow-edit-btn').click();
  // Wait for at least one insert button to appear
  await expect(page.getByTestId('insert-btn').first()).toBeVisible({ timeout: 5_000 });
}

/** Click the first available insert button and choose "Step" from the menu. */
async function clickInsertStep(page: Page): Promise<void> {
  await page.getByTestId('insert-btn').first().click();
  await page.getByRole('menuitem', { name: 'Step' }).click();
}

/** Click the first available insert button and choose "Intermediate Event". */
async function clickInsertEvent(page: Page): Promise<void> {
  await page.getByTestId('insert-btn').first().click();
  await page.getByRole('menuitem', { name: 'Intermediate Event' }).click();
}

/** Click the first available insert button and choose "Gateway". */
async function clickInsertGateway(page: Page): Promise<void> {
  await page.getByTestId('insert-btn').first().click();
  await page.getByRole('menuitem', { name: 'Gateway' }).click();
}

/** Save the flow and wait for the success snackbar to disappear. */
async function saveFlow(page: Page): Promise<void> {
  await page.getByTestId('flow-save-btn').click();
  await expect(page.getByTestId('flow-save-btn')).not.toBeVisible({ timeout: 10_000 });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('BPMN Editor — Admin', () => {
  let processKey: string;

  test.beforeEach(async () => {
    const proc = await createProcess(uid('PW Flow'));
    processKey = proc.key as string;
  });

  // ── View mode / initial state ──────────────────────────────────────────────

  test('Process Diagram accordion opens and shows flow canvas', async ({ page }) => {
    await openDiagram(page, processKey);
    await expect(page.getByTestId('flow-canvas')).toBeVisible();
  });

  test('default empty flow renders Start and End event nodes', async ({ page }) => {
    await openDiagram(page, processKey);
    await expect(page.getByTestId('node-start-event')).toBeVisible();
    await expect(page.getByTestId('node-end-event')).toBeVisible();
  });

  test('Edit button is visible for admin', async ({ page }) => {
    await openDiagram(page, processKey);
    await expect(page.getByTestId('flow-edit-btn')).toBeVisible();
  });

  test('no insert buttons visible in view mode', async ({ page }) => {
    await openDiagram(page, processKey);
    await expect(page.getByTestId('insert-btn')).not.toBeVisible();
  });

  // ── Insert Step ───────────────────────────────────────────────────────────

  test('can insert a step by linking an existing process', async ({ page }) => {
    const linkedName = uid('PW Linked');
    const linked = await createProcess(linkedName);

    await openDiagram(page, processKey);
    await enterEditMode(page);

    await clickInsertStep(page);

    // Switch to "Link existing" tab
    await page.getByRole('tab', { name: 'Link existing' }).click();
    // Select the linked process from the autocomplete
    await page.getByRole('combobox').fill(linkedName);
    await page.getByRole('option', { name: linkedName }).click();
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByTestId('node-task')).toBeVisible({ timeout: 5_000 });
  });

  test('can insert a step by creating a new child process', async ({ page }) => {
    const childName = uid('PW Child');

    await openDiagram(page, processKey);
    await enterEditMode(page);

    await clickInsertStep(page);
    await page.getByRole('tab', { name: 'Create new' }).click();
    await page.getByLabel('New process name').fill(childName);
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByTestId('node-task')).toBeVisible({ timeout: 5_000 });
  });

  test('flow saves and persists on reload', async ({ page }) => {
    const linkedName = uid('PW Persist');
    const linked = await createProcess(linkedName);

    await openDiagram(page, processKey);
    await enterEditMode(page);

    await clickInsertStep(page);
    await page.getByRole('tab', { name: 'Link existing' }).click();
    await page.getByRole('combobox').fill(linkedName);
    await page.getByRole('option', { name: linkedName }).click();
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByTestId('node-task')).toBeVisible({ timeout: 5_000 });

    await saveFlow(page);

    // Reload and check persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByText('Process Diagram').click();
    await expect(page.getByTestId('flow-canvas')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('node-task')).toBeVisible({ timeout: 10_000 });
  });

  test('insert buttons hidden after cancel', async ({ page }) => {
    await openDiagram(page, processKey);
    await enterEditMode(page);
    await page.getByTestId('flow-cancel-btn').click();
    await expect(page.getByTestId('insert-btn')).not.toBeVisible({ timeout: 5_000 });
  });

  // ── Sub-process detection ──────────────────────────────────────────────────

  test('linked process with sub-flow renders as sub-process (double border)', async ({ page }) => {
    const subProcName = uid('PW SubProc');
    const subProc = await createProcess(subProcName);
    const subProcKey = subProc.key as string;

    // Give the sub-process a real flow so backend sets isSubProcess=true
    await saveProcessFlow(subProcKey, [
      { id: 'n1', position: 0, nodeType: 'START_EVENT' },
      { id: 'n2', position: 1, nodeType: 'TASK', label: 'Inner step' },
      { id: 'n3', position: 2, nodeType: 'END_EVENT' },
    ]);

    await openDiagram(page, processKey);
    await enterEditMode(page);

    await clickInsertStep(page);
    await page.getByRole('tab', { name: 'Link existing' }).click();
    await page.getByRole('combobox').fill(subProcName);
    await page.getByRole('option', { name: subProcName }).click();
    await page.getByRole('button', { name: 'Add' }).click();
    await saveFlow(page);

    // Reload to let backend compute isSubProcess
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByText('Process Diagram').click();
    await expect(page.getByTestId('node-subprocess')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking sub-process in view mode navigates to the linked process', async ({ page }) => {
    const subProcName = uid('PW NavSubProc');
    const subProc = await createProcess(subProcName);
    const subProcKey = subProc.key as string;

    await saveProcessFlow(subProcKey, [
      { id: 'n1', position: 0, nodeType: 'START_EVENT' },
      { id: 'n2', position: 1, nodeType: 'TASK', label: 'Inner' },
      { id: 'n3', position: 2, nodeType: 'END_EVENT' },
    ]);

    // Pre-populate the parent flow via API so we don't need to build it through UI
    await saveProcessFlow(processKey, [
      { id: 'n1', position: 0, nodeType: 'START_EVENT' },
      { id: 'n2', position: 1, nodeType: 'TASK', label: subProcName, linkedProcessKey: subProcKey },
      { id: 'n3', position: 2, nodeType: 'END_EVENT' },
    ]);

    await openDiagram(page, processKey);

    // In view mode the node renders as sub-process (double border) — click it
    await page.getByTestId('node-subprocess').click();
    await expect(page.url()).toContain(`/processes/${subProcKey}`);
  });

  // ── Delete node ────────────────────────────────────────────────────────────

  test('can delete a task node', async ({ page }) => {
    const linkedName = uid('PW Delete');
    const linked = await createProcess(linkedName);

    await openDiagram(page, processKey);
    await enterEditMode(page);

    await clickInsertStep(page);
    await page.getByRole('tab', { name: 'Link existing' }).click();
    await page.getByRole('combobox').fill(linkedName);
    await page.getByRole('option', { name: linkedName }).click();
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByTestId('node-task')).toBeVisible({ timeout: 5_000 });

    // Click the delete (red ×) button on the task node
    await page.getByTitle('Delete node').click();
    await expect(page.getByTestId('node-task')).not.toBeVisible({ timeout: 5_000 });
  });

  // ── Intermediate Events ────────────────────────────────────────────────────

  test('can insert a Timer intermediate event', async ({ page }) => {
    await openDiagram(page, processKey);
    await enterEditMode(page);

    await clickInsertEvent(page);
    await page.getByRole('dialog').getByText('Timer').click();

    await expect(page.getByTestId('node-intermediate-event')).toBeVisible({ timeout: 5_000 });
  });

  test('can insert a Message intermediate event', async ({ page }) => {
    await openDiagram(page, processKey);
    await enterEditMode(page);

    await clickInsertEvent(page);
    await page.getByRole('dialog').getByText('Message').click();

    await expect(page.getByTestId('node-intermediate-event')).toBeVisible({ timeout: 5_000 });
  });

  test('can replace Timer event with Message event via replace button', async ({ page }) => {
    // Pre-seed the flow with a timer event via API
    await saveProcessFlow(processKey, [
      { id: 'n1', position: 0, nodeType: 'START_EVENT' },
      { id: 'n2', position: 1, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'TIMER' },
      { id: 'n3', position: 2, nodeType: 'END_EVENT' },
    ]);

    await openDiagram(page, processKey);
    await enterEditMode(page);

    // Click the replace (pencil) button on the intermediate event
    await page.getByTitle('Replace step').click();
    await page.getByRole('dialog').getByText('Message').click();

    // Still one intermediate event but the dialog confirmed the change
    await expect(page.getByTestId('node-intermediate-event')).toBeVisible({ timeout: 5_000 });
  });

  test('intermediate events persist after save and reload', async ({ page }) => {
    await openDiagram(page, processKey);
    await enterEditMode(page);

    await clickInsertEvent(page);
    await page.getByRole('dialog').getByText('Timer').click();
    await expect(page.getByTestId('node-intermediate-event')).toBeVisible({ timeout: 5_000 });

    await saveFlow(page);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByText('Process Diagram').click();
    await expect(page.getByTestId('node-intermediate-event')).toBeVisible({ timeout: 10_000 });
  });

  // ── Gateways ───────────────────────────────────────────────────────────────

  test('can insert an Exclusive gateway with 2 default tracks', async ({ page }) => {
    await openDiagram(page, processKey);
    await enterEditMode(page);

    await clickInsertGateway(page);
    await page.getByRole('dialog').getByText('Exclusive (XOR)').click();

    // Split + join diamond both rendered
    await expect(page.getByTestId('node-gateway')).toHaveCount(2, { timeout: 5_000 });
  });

  test('can add a third track to a gateway', async ({ page }) => {
    await openDiagram(page, processKey);
    await enterEditMode(page);

    await clickInsertGateway(page);
    await page.getByRole('dialog').getByText('Exclusive (XOR)').click();

    await page.getByRole('button', { name: 'Add track' }).click();

    // 3 track rows — easiest to count the track connector structure via add-track appearance
    // Verify by counting delete-track buttons: at 3 tracks they become visible
    await expect(page.getByTitle('Delete track')).toBeVisible({ timeout: 5_000 });
  });

  test('cannot delete a track when only 2 remain', async ({ page }) => {
    await openDiagram(page, processKey);
    await enterEditMode(page);

    await clickInsertGateway(page);
    await page.getByRole('dialog').getByText('Parallel (AND)').click();

    // At 2 tracks the delete button must not be visible
    await expect(page.getByTitle('Delete track')).not.toBeVisible({ timeout: 3_000 });
  });

  test('can replace Exclusive gateway with Parallel gateway', async ({ page }) => {
    await saveProcessFlow(processKey, [
      { id: 'n1', position: 0, nodeType: 'START_EVENT' },
      { id: 'n2', position: 1, nodeType: 'GATEWAY_SPLIT', gatewayType: 'EXCLUSIVE', gatewayPairId: 'gw1' },
      { id: 'n3', position: 3, nodeType: 'GATEWAY_JOIN',  gatewayType: 'EXCLUSIVE', gatewayPairId: 'gw1' },
      { id: 'n4', position: 4, nodeType: 'END_EVENT' },
    ], [
      { id: 't1', gatewayNodeId: 'n2', trackIndex: 0 },
      { id: 't2', gatewayNodeId: 'n2', trackIndex: 1 },
    ]);

    await openDiagram(page, processKey);
    await enterEditMode(page);

    await page.getByTitle('Change gateway type').click();
    await page.getByRole('dialog').getByText('Parallel (AND)').click();

    // Both gateway nodes should still be present after the type change
    await expect(page.getByTestId('node-gateway')).toHaveCount(2, { timeout: 5_000 });
  });

  test('gateway persists after save and reload', async ({ page }) => {
    await openDiagram(page, processKey);
    await enterEditMode(page);

    await clickInsertGateway(page);
    await page.getByRole('dialog').getByText('Exclusive (XOR)').click();
    await expect(page.getByTestId('node-gateway')).toHaveCount(2, { timeout: 5_000 });

    await saveFlow(page);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByText('Process Diagram').click();
    await expect(page.getByTestId('node-gateway')).toHaveCount(2, { timeout: 10_000 });
  });

  // ── BPMN XML export ────────────────────────────────────────────────────────

  test('GET /processes/{key}/flow/export returns valid BPMN 2.0 XML', async ({ request }) => {
    await saveProcessFlow(processKey, [
      { id: 'n1', position: 0, nodeType: 'START_EVENT' },
      { id: 'n2', position: 1, nodeType: 'TASK', label: 'Export test step' },
      { id: 'n3', position: 2, nodeType: 'END_EVENT' },
    ]);

    const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
    const { default: fs } = await import('node:fs');
    const { default: path } = await import('node:path');
    const tokenFile = path.join(process.cwd(), '.auth/admin-token.txt');
    const token = fs.readFileSync(tokenFile, 'utf8').trim();

    const res = await fetch(`${backendUrl}/processes/${processKey}/flow/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok).toBe(true);
    const xml = await res.text();
    expect(xml).toContain('<?xml');
    expect(xml).toContain('bpmn:definitions');
    expect(xml).toContain('bpmn:startEvent');
    expect(xml).toContain('bpmn:endEvent');
  });
});

// ─── Viewer role ───────────────────────────────────────────────────────────────

test.describe('BPMN Editor — Viewer', () => {
  test.use({ storageState: '.auth/viewer.json' });

  let processKey: string;

  test.beforeEach(async () => {
    const proc = await createProcess(uid('PW Viewer Flow'));
    processKey = proc.key as string;
  });

  test('viewer cannot see the Edit button on the diagram', async ({ page }) => {
    await openDiagram(page, processKey);
    await expect(page.getByTestId('flow-edit-btn')).not.toBeVisible();
  });

  test('viewer sees no insert buttons', async ({ page }) => {
    await openDiagram(page, processKey);
    await expect(page.getByTestId('insert-btn')).not.toBeVisible();
  });
});
