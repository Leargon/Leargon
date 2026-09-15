import { test, expect } from '@playwright/test';
import {
  uid,
  createDomain,
  createBoundedContext,
  createBoundedContextOwnedBy,
  createEntityInContext,
  apiStatus,
  REALM_OWNER,
  REALM_OWNER_USERNAME,
  VIEWER,
} from './api-setup';

/**
 * Negative advisor paths. A realm owner may open the entity wizard (they own a bounded context), but when the
 * advisor recommends a place outside their realm it says so and whom to ask, and the wizard's placement stays
 * as it was. The API refuses answers and start items that do not fit the tree.
 */
test.describe('Entity creation wizard — advice outside the user’s realm', () => {
  test.use({ storageState: REALM_OWNER });

  test('a child of a foreign entity is not allowed and does not change the placement', async ({ page }) => {
    const ownDomain = (await createDomain(uid('PW Advisor Own Domain'))) as { key: string };
    await createBoundedContextOwnedBy(ownDomain.key, uid('PW Advisor Own Context'), REALM_OWNER_USERNAME);
    const foreignDomain = (await createDomain(uid('PW Advisor Foreign Domain'))) as { key: string };
    const foreignContext = (await createBoundedContext(foreignDomain.key, uid('PW Advisor Foreign Context'))) as { key: string };
    const foreignOrder = uid('PW Advisor Foreign Order');
    await createEntityInContext(foreignOrder, foreignContext.key);

    await page.goto('/entities');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'New', exact: true }).click();
    const wizard = page.getByRole('dialog');
    await wizard.getByTestId('advisor-panel-toggle').click();

    await wizard.getByTestId('advisor-option-connected').click();
    await expect(wizard.getByTestId('advisor-question-entity.relatedPick')).toBeVisible({ timeout: 10_000 });
    await wizard.getByTestId('advisor-picker').getByRole('combobox').fill(foreignOrder);
    await page.getByRole('option', { name: new RegExp(foreignOrder) }).first().click();
    for (const [question, option] of [['entity.lifecycle', 'yes'], ['entity.identity', 'no'], ['entity.responsibility', 'no']]) {
      await expect(wizard.getByTestId(`advisor-question-${question}`)).toBeVisible({ timeout: 10_000 });
      await wizard.getByTestId(`advisor-option-${option}`).click();
    }

    await expect(wizard.getByTestId('advisor-outcome-CHILD_AGGREGATE')).toBeVisible({ timeout: 10_000 });
    await expect(wizard.getByTestId('advisor-not-allowed')).toBeVisible();
    // The refused recommendation is not applied: it is still a new root entity, not a child.
    await expect(wizard.getByText('Create Business Entity')).toBeVisible();
    await expect(wizard.getByText('Create Child Entity')).not.toBeVisible();
  });
});

test.describe('Advisor API — refusals', () => {
  test('an invalid answer and a start item of the wrong type are refused (400)', async () => {
    const nonsense = await apiStatus(
      '/advisor/evaluate',
      'POST',
      { ruleSetCode: 'ENTITY_PLACEMENT', answers: [{ questionCode: 'entity.relation', optionCode: 'nonsense' }] },
      VIEWER,
    );
    expect(nonsense).toBe(400);

    const badStart = await apiStatus(
      '/advisor/evaluate',
      'POST',
      { ruleSetCode: 'DOMAIN_PLACEMENT', contextItemKey: 'no-such-domain', answers: [] },
      VIEWER,
    );
    expect(badStart).toBe(400);
  });
});
