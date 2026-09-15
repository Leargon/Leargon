import { test, expect, type Locator } from '@playwright/test';
import { ADMIN, uid, apiGet, createDomain, createProcess, createCapability } from './api-setup';

/**
 * The collapsed "Not sure where this belongs?" panel in the other creation wizards: an allowed recommendation
 * fills in the wizard's placement, started from "Add sub-process / subdomain" with the questions about that item.
 */
test.describe('Advisor panel in the process, capability and domain wizards', () => {
  test.use({ storageState: ADMIN });

  const answer = async (wizard: Locator, questionCode: string, option: string) => {
    await expect(wizard.getByTestId(`advisor-question-${questionCode}`)).toBeVisible({ timeout: 10_000 });
    await wizard.getByTestId(`advisor-option-${option}`).click();
  };

  test('"Add sub-process": an activity with its own purpose becomes its own root process', async ({ page }) => {
    const parent = (await createProcess(uid('PW Advisor Fulfilment'))) as { key: string };

    await page.goto(`/processes/${parent.key}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Sub-process' }).click();
    const wizard = page.getByRole('dialog');
    await wizard.getByTestId('advisor-panel-toggle').click();

    // Started from the process: "a step of it" is pre-answered, so the own-purpose question comes first.
    await answer(wizard, 'process.ownPurpose', 'yes');
    await expect(wizard.getByTestId('advisor-outcome-SEPARATE_ACTIVITY')).toBeVisible({ timeout: 10_000 });

    await wizard.getByRole('textbox').first().fill(uid('PW Advisor Returns'));
    const create = wizard.getByRole('button', { name: 'Create', exact: true });
    for (let i = 0; i < 10 && !(await create.isVisible()); i++) {
      await wizard.getByRole('button', { name: 'Next' }).click();
    }
    await create.click();

    await page.waitForURL((url) => url.pathname.startsWith('/processes/') && !url.pathname.endsWith(`/${parent.key}`), { timeout: 10_000 });
    const key = decodeURIComponent(new URL(page.url()).pathname.split('/processes/')[1]);
    const created = await apiGet<{ parentProcess?: { key: string } | null }>(`/processes/${key}`, ADMIN);
    expect(created.parentProcess ?? null).toBeNull();
  });

  test('"New" capability: a refinement is placed under the capability it refines', async ({ page }) => {
    const parentName = uid('PW Advisor Selling');
    const parent = (await createCapability(parentName)) as { key: string };

    await page.goto('/capabilities');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'New', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByTestId('advisor-panel-toggle').click();

    await answer(dialog, 'capability.refines', 'yes');
    await expect(dialog.getByTestId('advisor-question-capability.parentPick')).toBeVisible({ timeout: 10_000 });
    await dialog.getByTestId('advisor-picker').getByRole('combobox').fill(parentName);
    await page.getByRole('option', { name: new RegExp(parentName) }).first().click();
    await expect(dialog.getByTestId('advisor-outcome-SUB_CAPABILITY')).toBeVisible({ timeout: 10_000 });

    await dialog.getByRole('textbox').first().fill(uid('PW Advisor Quoting'));
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();

    await page.waitForURL((url) => url.pathname.startsWith('/capabilities/') && !url.pathname.endsWith(`/${parent.key}`), { timeout: 10_000 });
    const key = decodeURIComponent(new URL(page.url()).pathname.split('/capabilities/')[1]);
    const created = await apiGet<{ parent?: { key: string } | null }>(`/capabilities/${key}`, ADMIN);
    expect(created.parent?.key).toBe(parent.key);
  });

  test('"Add Subdomain": a team\'s model boundary is added as a bounded context of that domain instead', async ({ page }) => {
    const domain = (await createDomain(uid('PW Advisor Commerce'))) as { key: string };

    await page.goto(`/domains/${domain.key}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Subdomain' }).click();
    const wizard = page.getByRole('dialog');
    await wizard.getByTestId('advisor-panel-toggle').click();

    await answer(wizard, 'domain.kind', 'modelBoundary');
    await expect(wizard.getByTestId('advisor-outcome-BOUNDED_CONTEXT')).toBeVisible({ timeout: 10_000 });
    await wizard.getByTestId('advisor-add-context').click();

    // The domain's own "Add bounded context" dialog opens.
    await expect(page.getByRole('dialog').getByLabel('Name (English)')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(new RegExp(`/domains/${domain.key}`));
  });
});
