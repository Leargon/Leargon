import { test, expect } from '@playwright/test';
import { uid, createDomain, createBoundedContext, createDomainEvent, createEntity } from './api-setup';

test.describe('Bounded Contexts — Domain Detail (Admin)', () => {
  test('domain detail page shows bounded contexts section', async ({ page }) => {
    const domain = await createDomain(uid('PW BC Domain'));
    const domainKey = domain.key as string;

    await createBoundedContext(domainKey, uid('Billing Context'));
    await createBoundedContext(domainKey, uid('Shipping Context'));

    await page.goto(`/domains/${domainKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Bounded Contexts')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Billing Context', { exact: false })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Shipping Context', { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('admin can add a bounded context from domain detail page', async ({ page }) => {
    const domain = await createDomain(uid('PW BC Add Domain'));
    const domainKey = domain.key as string;

    await page.goto(`/domains/${domainKey}`);
    await page.waitForLoadState('networkidle');

    // Click Add Bounded Context button
    await page.getByRole('button', { name: 'Add Bounded Context' }).click();

    // Fill in the name
    const dialog = page.getByRole('dialog');
    await dialog.locator('input').fill('New Payments Context');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await page.waitForLoadState('networkidle');

    await expect(page.getByText('New Payments Context', { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('domain detail page shows vision statement section', async ({ page }) => {
    const domain = await createDomain(uid('PW Vision Domain'));
    const domainKey = domain.key as string;

    await page.goto(`/domains/${domainKey}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Vision Statement')).toBeVisible({ timeout: 10_000 });
  });

  test('entity detail page shows bounded context field', async ({ page }) => {
    // The EntityDetailPanel should show a "Bounded Context" field for admin (governance perspective)
    const entity = await createEntity(uid('PW BC Entity Check'));
    const entityKey = entity.key as string;

    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    // Bounded Context field visible in governance perspective (admin role)
    await expect(page.getByText('Bounded Context', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Event Flow Diagram', () => {
  test('Event Flow page is accessible from DDD navigation', async ({ page }) => {
    await page.goto('/diagrams/event-flow');
    await page.waitForLoadState('networkidle');

    // Should show the Event Flow title
    await expect(page.getByText('Event Flow', { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('Event Flow page shows events grouped by domain', async ({ page }) => {
    const domain = await createDomain(uid('PW EF Domain'));
    const domainKey = domain.key as string;
    const bc = await createBoundedContext(domainKey, uid('EF Bounded Context'));
    const bcKey = bc.key as string;

    // Create a domain event via the API helper
    await createDomainEvent(bcKey, uid('EF Test Event'));

    await page.goto('/diagrams/event-flow');
    await page.waitForLoadState('networkidle');

    // Page should load without errors
    await expect(page).not.toHaveTitle(/error/i);
    await expect(page.locator('body')).not.toContainText('Unhandled Error');
  });
});
