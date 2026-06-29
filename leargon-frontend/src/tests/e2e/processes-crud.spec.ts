import { test, expect } from '@playwright/test';
import {
  createProcess,
  createOrgUnit,
  assignOwningUnitToProcess,
  setProcessDescriptions,
  setProcessLegalBasis,
  setProcessPurpose,
  uid,
  createProcessOwnedBy,
  createEntity,
  assignClassificationsToEntity,
  addProcessInput,
} from './api-setup';

// ──────────────────────────────────────────────────────────────────────────────
// Admin tests — uses default project storageState (.auth/admin.json)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Business Process CRUD — Admin', () => {
  let processKey: string;
  let processName: string;

  test.beforeEach(async () => {
    processName = uid('PW Process');
    const process = await createProcess(processName);
    processKey = process.key as string;

    // Link an entity with personal data so compliance fields (Legal Basis) are visible
    const entity = await createEntity(uid('PW Admin Personal Data Entity'));
    const entityKey = entity.key as string;
    await assignClassificationsToEntity(entityKey, [
      { classificationKey: 'personal-data', valueKey: 'personal-data--contains' },
    ]);
    await addProcessInput(processKey, entityKey);
  });

  test('can create a business process via UI', async ({ page }) => {
    const newName = uid('PW New Process');

    await page.goto('/processes');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('dialog').getByLabel('Name (English)').fill(newName);
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('heading', { name: newName })).toBeVisible({ timeout: 10_000 });
  });

  test('can rename a business process', async ({ page }) => {
    const newName = uid('PW Renamed Process');

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await page.locator('button:has([data-testid="EditIcon"])').first().click();
    const nameInput = page.getByLabel('Name (English)');
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByRole('heading', { name: newName })).toBeVisible({ timeout: 10_000 });
  });

  test('can delete a business process', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);

    await page.getByTestId('delete-process-btn').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).not.toHaveURL(new RegExp(`/processes/${processKey}`), { timeout: 10_000 });
  });

  test('admin can set legal basis via UI', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    // Find the Legal Basis label and its sibling edit button
    const label = page.getByText('Legal Basis', { exact: true });
    await label.locator('..').getByRole('button').click();

    // Select "Contract" from the dropdown
    const valueContainer = label.locator('..').locator('xpath=following-sibling::div');
    await valueContainer.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Contract' }).click();

    // Save
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    // Verify the value in the row (using exact to avoid the nudge text)
    // The value is in the next sibling Box of the label's parent Box
    await expect(valueContainer.getByText('Contract', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('legal basis chip is visible when set', async ({ page }) => {
    await setProcessLegalBasis(processKey, 'LEGAL_OBLIGATION');

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    // Verify the chip is visible. Use a more specific locator to avoid the header chip if needed, 
    // but here we just want to ensure it's visible somewhere.
    await expect(page.getByText('Legal Obligation', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('legal basis shows "Not set" when not set', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    // Find the value container for Legal Basis
    const valueContainer = page.getByText('Legal Basis', { exact: true }).locator('..').locator('xpath=following-sibling::div');
    await expect(valueContainer.getByText('Not set', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('purpose is visible in Compliance tab when set', async ({ page }) => {
    await setProcessPurpose(processKey, 'E2E purpose: manage billing data');

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Compliance accordion
    await page.locator('[aria-expanded]').filter({ hasText: 'Compliance' }).click();

    await expect(page.getByText('E2E purpose: manage billing data')).toBeVisible();
  });

  test('purpose appears in CompliancePage table', async ({ page }) => {
    await setProcessLegalBasis(processKey, 'LEGAL_OBLIGATION');
    await setProcessPurpose(processKey, 'E2E compliance page purpose');

    await page.goto('/compliance');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('E2E compliance page purpose', { exact: false })).toBeVisible();
  });

  test('non-default locale description is visible in accordion after being set via API', async ({ page }) => {
    await setProcessDescriptions(processKey, [
      { locale: 'en', text: 'English description for accordion test' },
      { locale: 'de', text: 'Deutsche Beschreibung für Akkordeon-Test' },
    ]);

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Deutsch/i }).click();

    await expect(
      page.getByText('Deutsche Beschreibung für Akkordeon-Test'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('description in non-default locale persists after edit and page reload', async ({ page }) => {
    // Start with no descriptions
    await page.goto(`/processes/${processKey}`);
    await page.waitForSelector('text=Names & Descriptions', { timeout: 10_000 });

    // Click edit on the Names & Descriptions section
    await page.locator('button:has([data-testid="EditIcon"])').first().click();

    // Switch to the German tab in the TranslationEditor
    await page.getByRole('tab', { name: /Deutsch/i }).click();

    // Enter a description — label is "Description (Deutsch)" (UI locale is English, DB locale is Deutsch)
    await page.getByLabel(/Description.*Deutsch/i).fill('E2E Deutsche Beschreibung');

    // Click save and wait for the descriptions PUT to the backend to complete
    const [descResponse] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/descriptions') && resp.request().method() === 'PUT',
        { timeout: 15_000 },
      ),
      page.locator('button:has([data-testid="CheckIcon"])').first().click(),
    ]);
    expect(descResponse.status()).toBe(200);

    // Navigate fresh to verify persistence
    await page.goto(`/processes/${processKey}`);
    await page.waitForSelector('text=Names & Descriptions', { timeout: 10_000 });

    await page.getByRole('button', { name: /Deutsch/i }).click();

    await expect(page.getByText('E2E Deutsche Beschreibung')).toBeVisible({ timeout: 5_000 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Owner tests — process created by owner, so they have edit/delete rights
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Business Process CRUD — Owner', () => {
  test.use({ storageState: '.auth/owner.json' });

  let processKey: string;

  test.beforeEach(async () => {
    // Created by admin, then ownership handed to the owner persona (a plain ROLE_USER can no
    // longer create root items, but still owns/edits/deletes what they are made owner of).
    const process = await createProcessOwnedBy(uid('PW Owner Process'));
    processKey = process.key as string;
  });

  test('can rename their business process', async ({ page }) => {
    const newName = uid('PW Owner Renamed Process');

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await page.locator('button:has([data-testid="EditIcon"])').first().click();
    const nameInput = page.getByLabel('Name (English)');
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.locator('button:has([data-testid="CheckIcon"])').click();

    await expect(page.getByRole('heading', { name: newName })).toBeVisible({ timeout: 10_000 });
  });

  test('can delete their business process', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);

    await page.getByTestId('delete-process-btn').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).not.toHaveURL(new RegExp(`/processes/${processKey}`), { timeout: 10_000 });
  });

  test('cannot see the New button', async ({ page }) => {
    await page.goto('/processes');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'New' })).not.toBeVisible();
  });

  test('can change the process owner', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    // Locate the Process Owner section and assert no edit icon is adjacent to it
    const ownerSection = page.getByText('Process Owner', { exact: false });
    await expect(ownerSection).toBeVisible();
    await expect(
      ownerSection.locator('..').locator('button:has([data-testid="EditIcon"])'),
    ).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Owning unit tests
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Business Process — Owning Unit', () => {
  let processKey: string;

  test.beforeEach(async () => {
    const process = await createProcess(uid('PW OU Process'));
    processKey = process.key as string;
  });

  test('owning unit chip is visible after assignment via API', async ({ page }) => {
    const unit = await createOrgUnit(uid('PW Ops Unit'));
    await assignOwningUnitToProcess(processKey, unit.key as string);

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(unit.key as string, { exact: false }).or(
      page.getByText('Ops Unit', { exact: false }),
    ).first()).toBeVisible({ timeout: 10_000 });
  });

  test('owning unit shows Not assigned when not set', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    const owningUnitRow = page.getByText('Owning Unit', { exact: true });
    await expect(owningUnitRow).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Not assigned').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Viewer tests — plain authenticated user, no ownership
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Business Process CRUD — Viewer', () => {
  test.use({ storageState: '.auth/viewer.json' });

  let processKey: string;

  test.beforeEach(async () => {
    const process = await createProcess(uid('PW Viewer Process'));
    processKey = process.key as string;

    // Link an entity with personal data so compliance fields (Legal Basis) are visible
    const entity = await createEntity(uid('PW Personal Data Entity'));
    const entityKey = entity.key as string;
    await assignClassificationsToEntity(entityKey, [
      { classificationKey: 'personal-data', valueKey: 'personal-data--contains' },
    ]);
    await addProcessInput(processKey, entityKey);
  });

  test('cannot see edit controls on process detail', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button:has([data-testid="EditIcon"])')).not.toBeVisible();
  });

  test('can see legal basis chip but not edit it', async ({ page }) => {
    await setProcessLegalBasis(processKey, 'CONSENT');

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    // Find the value container for Legal Basis
    const valueContainer = page.getByText('Legal Basis', { exact: true }).locator('..').locator('xpath=following-sibling::div');
    await expect(valueContainer.locator('span:has-text("Consent")')).toBeVisible();
    await expect(page.locator('button:has([data-testid="EditIcon"])')).not.toBeVisible();
  });

  test('cannot see the Delete button on process detail', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible();
  });

  test('does not see setup wizard when list is empty', async ({ page }) => {
    // Navigate to processes page — even if empty, no wizard should appear for a viewer
    await page.goto('/processes');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
