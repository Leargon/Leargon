import { test, expect } from '@playwright/test';
import { createProcess, createOrgUnit, assignOwningUnitToProcess, setProcessDescriptions, setProcessLegalBasis, setProcessPurpose, uid, OWNER } from './api-setup';

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

    // Find the Legal Basis section and click its edit button
    const legalBasisSection = page.getByText('Legal Basis', { exact: true });
    await legalBasisSection.locator('..').getByRole('button', { name: '' }).first().click();

    // Select "Contract" from the dropdown
    await page.getByRole('combobox').last().click();
    await page.getByRole('option', { name: 'Contract' }).click();

    // Save
    await page.locator('button:has([data-testid="CheckIcon"])').last().click();

    await expect(page.getByText('Contract', { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('legal basis chip is visible when set', async ({ page }) => {
    await setProcessLegalBasis(processKey, 'LEGAL_OBLIGATION');

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Legal Obligation', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('legal basis shows "Not set" when not set', async ({ page }) => {
    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    const legalBasisSection = page.getByText('Legal Basis', { exact: true });
    await expect(legalBasisSection).toBeVisible({ timeout: 10_000 });
    // The Not set text is within the same section
    await expect(page.getByText('Not set').first()).toBeVisible({ timeout: 10_000 });
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

    // The accordion preview shows the description in the summary without expanding.
    // Use .first() because the same text also appears in the collapsed AccordionDetails DOM.
    await expect(
      page.getByText('Deutsche Beschreibung für Akkordeon-Test').first(),
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

    // After reload the accordion preview shows the saved text in the summary.
    // Use .first() because the text also exists in the collapsed AccordionDetails DOM.
    await expect(page.getByText('E2E Deutsche Beschreibung').first()).toBeVisible({ timeout: 5_000 });
  });

  test('description accordion preview is shown in summary when description exists', async ({ page }) => {
    await setProcessDescriptions(processKey, [
      { locale: 'en', text: 'Preview text for summary test' },
    ]);

    await page.goto(`/processes/${processKey}`);
    await page.waitForLoadState('networkidle');

    // The preview caption should be visible without expanding the accordion.
    // Use .first() because the same text also exists in the collapsed AccordionDetails DOM.
    await expect(page.getByText('Preview text for summary test').first()).toBeVisible({ timeout: 5_000 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Owner tests — process created by owner, so they have edit/delete rights
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Business Process CRUD — Owner', () => {
  test.use({ storageState: '.auth/owner.json' });

  let processKey: string;

  test.beforeEach(async () => {
    // Create process as OWNER — creator automatically becomes processOwner
    const process = await createProcess(uid('PW Owner Process'), OWNER);
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

    await expect(page.getByText('Consent', { exact: false })).toBeVisible();
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
