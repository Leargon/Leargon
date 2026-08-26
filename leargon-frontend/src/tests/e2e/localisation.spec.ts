import { test, expect, type Page } from '@playwright/test';
import { uid, ADMIN } from './api-setup';
import fs from 'node:fs';
import nodePath from 'node:path';

/**
 * The user-facing acceptance for the localisation pass: a German reader must see the German catalogue.
 *
 * Two separate faults produced English text before. Catalogue names came back from the API resolved
 * against a hardcoded `"en"`, so an owning unit read "Logistics" rather than "Logistik". And a large
 * number of static labels never went through `t()` at all, so headings like "Classifications" and
 * "Parent Process" stayed English whatever the language picker said. These tests cover both.
 */

const backendUrl = (): string => process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';

function adminToken(): string {
  const abs = nodePath.join(process.cwd(), ADMIN.replace('.json', '-token.txt'));
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').trim() : '';
}

async function api(path: string, method: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${backendUrl()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken()}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  if (res.status === 204 || res.headers.get('content-length') === '0') return {};
  return res.json() as Promise<Record<string, unknown>>;
}

/** German has to be an active locale before anything can be named in it. */
async function ensureGermanLocale(): Promise<void> {
  const locales = (await api('/locales?includeInactive=true', 'GET')) as unknown as Array<{
    localeCode: string;
    id: number;
    isActive: boolean;
  }>;
  const german = locales.find((l) => l.localeCode === 'de');
  if (!german) {
    await api('/locales', 'POST', {
      localeCode: 'de',
      displayName: 'Deutsch',
      isActive: true,
      sortOrder: 2,
    });
  } else if (!german.isActive) {
    await api(`/locales/${german.id}`, 'PUT', { isActive: true });
  }
}

/** Switches the in-app language picker, which drives both the UI language and the catalogue locale. */
async function switchLanguageTo(page: Page, displayName: string): Promise<void> {
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: displayName }).click();
  // The picker writes the choice through to localStorage; wait for it to settle before asserting.
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('leargon-preferred-locale')))
    .toBe('de');
}

test.describe('German reader sees the German catalogue', () => {
  let unitNameDe: string;
  let entityNameDe: string;
  let entityNameEn: string;
  let entityKey: string;

  test.beforeAll(async () => {
    await ensureGermanLocale();

    const stamp = Date.now();
    const unitNameEn = `Logistics ${stamp}`;
    unitNameDe = `Logistik ${stamp}`;
    entityNameEn = uid('Order Line Item');
    entityNameDe = `Bestellposition ${stamp}`;

    const unit = await api('/organisational-units', 'POST', {
      names: [
        { locale: 'en', text: unitNameEn },
        { locale: 'de', text: unitNameDe },
      ],
    });

    const entity = await api('/business-entities', 'POST', {
      names: [
        { locale: 'en', text: entityNameEn },
        { locale: 'de', text: entityNameDe },
      ],
    });
    entityKey = entity.key as string;

    await api(`/business-entities/${entityKey}/owning-unit`, 'PUT', { owningUnitKey: unit.key });
  });

  test.afterEach(async ({ page }) => {
    // The language choice is persisted, so it would leak into every spec that runs afterwards.
    await page.evaluate(() => localStorage.removeItem('leargon-preferred-locale'));
  });

  test('the owning unit of an entity reads in German, not English', async ({ page }) => {
    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await switchLanguageTo(page, 'Deutsch');

    // This is the reported symptom: the owning unit chip said "Logistics" to a German reader.
    await expect(page.getByText(unitNameDe, { exact: false })).toBeVisible({ timeout: 20_000 });
  });

  test('the entity title itself reads in German', async ({ page }) => {
    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await switchLanguageTo(page, 'Deutsch');

    // The panel heading is the reader-facing name. The names editor further down deliberately shows
    // every locale at once, so the English text is legitimately still on the page.
    await expect(page.getByRole('heading', { name: entityNameDe })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: entityNameEn, exact: true })).toHaveCount(0);
  });

  test('static section headings are translated rather than left in English', async ({ page }) => {
    await page.goto(`/entities/${entityKey}`);
    await page.waitForLoadState('networkidle');

    await switchLanguageTo(page, 'Deutsch');
    await page.waitForLoadState('networkidle');

    // Field labels on the always-visible part of the panel. These are the ones that used to stay
    // English no matter what the language picker said.
    await expect(page.getByText('Namen & Beschreibungen')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Zuständige Einheit')).toBeVisible();
    await expect(page.getByText('Übergeordnete Entität')).toBeVisible();
    await expect(page.getByText('Owning Unit', { exact: true })).toHaveCount(0);

    // "Classifications" was the reported heading; it sits inside the collapsed Governance accordion.
    await page.getByRole('button', { name: 'Governance', exact: true }).click();
    await expect(page.getByText('Klassifikationen', { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Classifications', { exact: true })).toHaveCount(0);
  });

  test('the navigation menu is translated', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    await switchLanguageTo(page, 'Deutsch');
    await page.waitForLoadState('networkidle');

    // "Profile" and "Logout" live behind the account button, so the menu has to be opened first.
    // Both were hardcoded English before this pass.
    await page.getByRole('button', { name: /e2eadmin|admin/i }).last().click();
    await expect(page.getByRole('menuitem', { name: 'Profil' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('menuitem', { name: 'Abmelden' })).toBeVisible();
  });

  test('a signed-out visitor is sent to login rather than shown catalogue text', async ({ page, context }) => {
    // Negative/permission case: localisation must not have opened up an unauthenticated read.
    await context.clearCookies();
    await page.goto('/entities');
    await page.evaluate(() => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    });

    await page.goto(`/entities/${entityKey}`);

    await page.waitForURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByText(entityNameDe, { exact: false })).toHaveCount(0);
  });
});
