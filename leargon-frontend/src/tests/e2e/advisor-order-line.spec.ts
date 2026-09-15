import { test, expect, type Locator, type Page } from '@playwright/test';
import { ADMIN, uid, apiGet, createDomain, createBoundedContext, createEntityInContext } from './api-setup';

interface EntityWithRelationships {
  parent?: { key: string } | null;
  relationships: Array<{ cardinality: Array<{ businessEntity: { key: string } }> }>;
}

/**
 * The advisor's decision tree sits collapsed in the entity creation wizard — from "New" (root) and from
 * "Add child" (sub). "Order Line" lives and dies with its Order and has nothing of its own → child.
 * "Address" lives on its own → a root entity, created together with its relationship to the Customer.
 */
test.describe('Entity creation wizard — child entity or root entity with relationship', () => {
  test.use({ storageState: ADMIN });

  const entityInNewContext = async (name: string) => {
    const domain = (await createDomain(uid('PW Advisor Domain'))) as { key: string };
    const context = (await createBoundedContext(domain.key, uid('PW Advisor Context'))) as { key: string };
    return (await createEntityInContext(name, context.key)) as { key: string };
  };

  const answer = async (wizard: Locator, questionCode: string, option: string) => {
    await expect(wizard.getByTestId(`advisor-question-${questionCode}`)).toBeVisible({ timeout: 10_000 });
    await wizard.getByTestId(`advisor-option-${option}`).click();
  };

  const pick = async (page: Page, wizard: Locator, name: string) => {
    await wizard.getByTestId('advisor-picker').getByRole('combobox').fill(name);
    await page.getByRole('option', { name: new RegExp(name) }).first().click();
  };

  /** Names the entity on the identity step and clicks through the remaining steps to Create. */
  const nameAndCreate = async (wizard: Locator, name: string) => {
    await wizard.getByRole('textbox').first().fill(name);
    const create = wizard.getByRole('button', { name: 'Create', exact: true });
    for (let i = 0; i < 10 && !(await create.isVisible()); i++) {
      await wizard.getByRole('button', { name: 'Next' }).click();
    }
    await create.click();
    await expect(wizard).not.toBeVisible({ timeout: 10_000 });
  };

  /**
   * On the new entity's page (reached after Create): it is a root entity whose relationship to [related] was
   * created in the same request — checked via the API and in the (collapsed) Relationships section.
   */
  const expectRootWithRelationshipTo = async (page: Page, newName: string, related: { key: string }, relatedName: string) => {
    await expect(page.getByRole('heading', { name: newName })).toBeVisible({ timeout: 10_000 });
    const key = decodeURIComponent(new URL(page.url()).pathname.split('/entities/')[1]);
    const created = await apiGet<EntityWithRelationships>(`/business-entities/${key}`, ADMIN);
    expect(created.parent ?? null).toBeNull();
    expect(created.relationships.flatMap((r) => r.cardinality.map((c) => c.businessEntity.key))).toContain(related.key);

    await page.getByRole('button', { name: 'Relationships' }).click();
    await expect(page.getByRole('cell', { name: new RegExp(relatedName) })).toBeVisible({ timeout: 10_000 });
  };

  test('the advisor is collapsed until the user expands it', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'New', exact: true }).click();
    const wizard = page.getByRole('dialog');

    await expect(wizard.getByTestId('advisor-panel-toggle')).toBeVisible();
    await expect(wizard.getByTestId('advisor-flow')).not.toBeVisible();
    await wizard.getByTestId('advisor-panel-toggle').click();
    await expect(wizard.getByTestId('advisor-question-entity.relation')).toBeVisible({ timeout: 10_000 });
  });

  test('from "New": a root entity connected to an existing one is created with its relationship', async ({ page }) => {
    const customerName = uid('PW Advisor Customer');
    const customer = await entityInNewContext(customerName);

    await page.goto('/entities');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'New', exact: true }).click();
    const wizard = page.getByRole('dialog');
    await wizard.getByTestId('advisor-panel-toggle').click();

    await answer(wizard, 'entity.relation', 'connected');
    await expect(wizard.getByTestId('advisor-question-entity.relatedPick')).toBeVisible({ timeout: 10_000 });
    await pick(page, wizard, customerName);
    await answer(wizard, 'entity.lifecycle', 'no');
    await answer(wizard, 'entity.cardinality', 'many');

    await expect(wizard.getByTestId('advisor-outcome-ROOT_WITH_RELATIONSHIP')).toBeVisible({ timeout: 10_000 });
    await expect(wizard.getByTestId('advisor-consequence-RELATIONSHIP_CREATED')).toBeVisible();
    await expect(wizard.getByTestId('advisor-panel-summary')).toBeVisible();
    const addressName = uid('PW Advisor Address');
    await nameAndCreate(wizard, addressName);

    await expectRootWithRelationshipTo(page, addressName, customer, customerName);
  });

  test('from "Add child": an Order Line that shares everything with its Order becomes its child', async ({ page }) => {
    const order = await entityInNewContext(uid('PW Advisor Order'));

    await page.goto(`/entities/${order.key}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /add child/i }).click();
    const wizard = page.getByRole('dialog');
    await wizard.getByTestId('advisor-panel-toggle').click();

    // Started from the Order: the tree skips "connected to which entity?" and asks about the Order directly.
    await answer(wizard, 'entity.lifecycle', 'yes');
    await answer(wizard, 'entity.identity', 'no');
    await answer(wizard, 'entity.responsibility', 'no');
    await expect(wizard.getByTestId('advisor-outcome-CHILD_AGGREGATE')).toBeVisible({ timeout: 10_000 });
    await expect(wizard.getByTestId('advisor-consequence-ENTITY_ROLLS_UP_TO_ROOT')).toBeVisible();

    await nameAndCreate(wizard, uid('PW Advisor Order Line'));
    // Child keys are built under the parent's key.
    await expect(page).toHaveURL(new RegExp(`/entities/${order.key}\\.`), { timeout: 10_000 });
  });

  test('from "Add child": when the answers say it lives on its own, it becomes a root entity with a relationship', async ({ page }) => {
    const customerName = uid('PW Advisor Customer');
    const customer = await entityInNewContext(customerName);

    await page.goto(`/entities/${customer.key}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /add child/i }).click();
    const wizard = page.getByRole('dialog');
    await expect(wizard.getByText('Create Child Entity')).toBeVisible();
    await wizard.getByTestId('advisor-panel-toggle').click();

    await answer(wizard, 'entity.lifecycle', 'yes');
    await answer(wizard, 'entity.identity', 'yes');
    await answer(wizard, 'entity.cardinality', 'many');
    await expect(wizard.getByTestId('advisor-outcome-ROOT_WITH_RELATIONSHIP')).toBeVisible({ timeout: 10_000 });
    // No longer a child.
    await expect(wizard.getByText('Create Business Entity')).toBeVisible();

    const addressName = uid('PW Advisor Address');
    await nameAndCreate(wizard, addressName);
    await expectRootWithRelationshipTo(page, addressName, customer, customerName);
  });
});
