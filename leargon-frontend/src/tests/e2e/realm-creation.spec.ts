import { test, expect } from '@playwright/test';
import {
  uid,
  createDomain,
  createDomainOwnedBy,
  createBoundedContextOwnedBy,
  apiStatus,
  REALM_OWNER,
  REALM_OWNER_USERNAME,
  VIEWER,
} from './api-setup';

/**
 * Decentralised, realm-based creation in the UI. The buttons come from backend-computed flags
 * (`creatableChildTypes`, `/creation/capabilities`), so a domain / bounded-context owner sees exactly the
 * creation actions the backend allows — and a stranger sees none (and is refused by the API).
 */
test.describe('Realm owner creates inside their realm', () => {
  test.use({ storageState: REALM_OWNER });

  test('a domain owner can add a bounded context to their domain, but cannot delete the domain', async ({ page }) => {
    const domainName = uid('PW Realm Domain');
    const domain = (await createDomainOwnedBy(domainName, REALM_OWNER_USERNAME)) as { key: string };

    await page.goto(`/domains/${domain.key}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(domainName).first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('button', { name: 'Add Subdomain' })).toBeVisible();
    // Deleting a domain stays with DDD editors / admins.
    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible();

    await page.getByRole('button', { name: 'Add Bounded Context' }).click();
    const dialog = page.getByRole('dialog');
    const bcName = uid('PW Realm Context');
    await dialog.getByLabel('Name (English)').fill(bcName);
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(bcName).first()).toBeVisible({ timeout: 10_000 });
  });

  test('a bounded-context owner sees the New button on the entities page', async ({ page }) => {
    const domain = (await createDomain(uid('PW Realm Host Domain'))) as { key: string };
    await createBoundedContextOwnedBy(domain.key, uid('PW Realm Owned Context'), REALM_OWNER_USERNAME);

    await page.goto('/entities');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'New', exact: true })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('A stranger cannot create in someone else’s realm', () => {
  test.use({ storageState: VIEWER });

  test('no creation actions are offered and the API refuses', async ({ page }) => {
    const domainName = uid('PW Foreign Domain');
    const domain = (await createDomainOwnedBy(domainName, REALM_OWNER_USERNAME)) as { key: string };
    const bc = (await createBoundedContextOwnedBy(domain.key, uid('PW Foreign Context'), REALM_OWNER_USERNAME)) as { key: string };

    await page.goto(`/domains/${domain.key}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(domainName).first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('button', { name: 'Add Subdomain' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Bounded Context' })).not.toBeVisible();

    const entityStatus = await apiStatus(
      '/business-entities',
      'POST',
      { names: [{ locale: 'en', text: uid('PW Sneaky Entity') }], boundedContextKey: bc.key },
      VIEWER,
    );
    expect(entityStatus).toBe(403);

    const bcStatus = await apiStatus(
      `/business-domains/${domain.key}/bounded-contexts`,
      'POST',
      { names: [{ locale: 'en', text: uid('PW Sneaky Context') }] },
      VIEWER,
    );
    expect(bcStatus).toBe(403);
  });
});
