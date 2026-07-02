import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, signup, signupAdmin, withToken, createEntity } from './testClient';
import type { AxiosInstance } from 'axios';
import type { SupportedLocaleResponse } from '@/api/generated/model/supportedLocaleResponse';
import type { BusinessEntityResponse } from '@/api/generated/model/businessEntityResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

/**
 * Locale / i18n management. Locales are shared, seeded state (en default + de/fr active), so this
 * spec only creates/removes uncommon ISO 639-1 codes and cleans them up to avoid cross-test drift.
 */
describe('Locale Management API', () => {
  let adminClient: AxiosInstance;
  let ownerClient: AxiosInstance;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    adminClient = createClient(baseUrl);
    ownerClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'locale-admin@example.com',
      username: 'localeadmin',
      password: 'password123',
      firstName: 'Locale',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const ownerAuth = await signup(ownerClient, {
      email: 'locale-user@example.com',
      username: 'localeuser',
      password: 'password123',
      firstName: 'Locale',
      lastName: 'User',
    });
    withToken(ownerClient, ownerAuth.accessToken);
  });

  const removeLocaleIfPresent = async (code: string) => {
    const res = await adminClient.get<SupportedLocaleResponse[]>('/locales?includeInactive=true');
    const found = res.data.find((l) => l.localeCode === code);
    if (found) await adminClient.delete(`/locales/${found.id}`);
  };

  // ─── GET ────────────────────────────────────────────────────────────────────

  it('lists active locales including the seeded default', async () => {
    const res = await ownerClient.get<SupportedLocaleResponse[]>('/locales');
    expect(res.status).toBe(200);
    const en = res.data.find((l) => l.localeCode === 'en');
    expect(en).toBeDefined();
    expect(en!.isDefault).toBe(true);
    expect(res.data.every((l) => l.isActive)).toBe(true);
  });

  it('requires authentication to list locales', async () => {
    const anon = createClient(getBackendUrl());
    const res = await anon.get('/locales');
    expect(res.status).toBe(401);
  });

  // ─── CREATE ───────────────────────────────────────────────────────────────

  it('admin can create a supported locale', async () => {
    await removeLocaleIfPresent('sv');
    const res = await adminClient.post<SupportedLocaleResponse>('/locales', {
      localeCode: 'sv',
      displayName: 'Svenska',
      isActive: true,
      sortOrder: 50,
    });
    expect(res.status).toBe(201);
    expect(res.data.localeCode).toBe('sv');
    expect(res.data.isDefault).toBe(false);
    expect(res.data.isActive).toBe(true);

    await adminClient.delete(`/locales/${res.data.id}`);
  });

  it('non-admin cannot create a locale', async () => {
    const res = await ownerClient.post('/locales', { localeCode: 'da', displayName: 'Dansk' });
    expect(res.status).toBe(403);
  });

  it('rejects a duplicate locale code', async () => {
    const res = await adminClient.post('/locales', { localeCode: 'en', displayName: 'English again' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-ISO-639-1 locale code', async () => {
    const res = await adminClient.post('/locales', { localeCode: 'zz', displayName: 'Nonsense' });
    expect(res.status).toBe(400);
  });

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  it('admin can deactivate a non-default locale, but not the default', async () => {
    await removeLocaleIfPresent('fi');
    const created = await adminClient.post<SupportedLocaleResponse>('/locales', {
      localeCode: 'fi',
      displayName: 'Suomi',
      isActive: true,
    });

    const deactivated = await adminClient.put<SupportedLocaleResponse>(`/locales/${created.data.id}`, {
      isActive: false,
    });
    expect(deactivated.status).toBe(200);
    expect(deactivated.data.isActive).toBe(false);

    // The default (en) cannot be deactivated
    const en = (await adminClient.get<SupportedLocaleResponse[]>('/locales')).data.find((l) => l.localeCode === 'en')!;
    const res = await adminClient.put(`/locales/${en.id}`, { isActive: false });
    expect(res.status).toBe(400);

    await adminClient.delete(`/locales/${created.data.id}`);
  });

  // ─── DELETE ───────────────────────────────────────────────────────────────

  it('admin can delete a non-default locale but not the default', async () => {
    await removeLocaleIfPresent('is');
    const created = await adminClient.post<SupportedLocaleResponse>('/locales', {
      localeCode: 'is',
      displayName: 'Íslenska',
    });
    const del = await adminClient.delete(`/locales/${created.data.id}`);
    expect(del.status).toBe(204);

    const en = (await adminClient.get<SupportedLocaleResponse[]>('/locales')).data.find((l) => l.localeCode === 'en')!;
    const res = await adminClient.delete(`/locales/${en.id}`);
    expect(res.status).toBe(400);
  });

  // ─── Inactive-locale text rejection ─────────────────────────────────────────

  it('rejects entity text in an unsupported/inactive locale', async () => {
    const res = await ownerClient.post<BusinessEntityResponse>('/business-entities', {
      names: [{ locale: 'zz', text: 'Unsupported locale name' }],
    });
    expect(res.status).toBe(400);
  });

  it('accepts entity text in seeded active locales (en + de)', async () => {
    const entity = await createEntity(adminClient, 'Locale Multi Entity');
    const res = await adminClient.put<BusinessEntityResponse>(`/business-entities/${entity.key}/names`, [
      { locale: 'en', text: 'Customer' },
      { locale: 'de', text: 'Kunde' },
    ]);
    expect(res.status).toBe(200);
    expect(res.data.names?.find((n) => n.locale === 'de')?.text).toBe('Kunde');
  });
});
