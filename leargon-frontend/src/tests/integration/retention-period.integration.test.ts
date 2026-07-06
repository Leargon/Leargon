import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, signup, signupCreator, signupAdmin, withToken, createEntity } from './testClient';
import type { AxiosInstance } from 'axios';
import type { BusinessEntityResponse } from '@/api/generated/model/businessEntityResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Retention Period E2E', () => {
  let ownerClient: AxiosInstance;
  let otherClient: AxiosInstance;
  let adminClient: AxiosInstance;

  beforeAll(async () => {
    ownerClient = createClient(getBackendUrl());
    otherClient = createClient(getBackendUrl());
    adminClient = createClient(getBackendUrl());

    const ownerAuth = await signupCreator(ownerClient, {
      email: 'fe-rp-owner@example.com',
      username: 'ferpowner',
      password: 'password123',
      firstName: 'RP',
      lastName: 'Owner',
    });
    withToken(ownerClient, ownerAuth.accessToken);

    const otherAuth = await signup(otherClient, {
      email: 'fe-rp-other@example.com',
      username: 'ferpother',
      password: 'password123',
      firstName: 'RP',
      lastName: 'Other',
    });
    withToken(otherClient, otherAuth.accessToken);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-rp-admin@example.com',
      username: 'fecpadmin',
      password: 'password123',
      firstName: 'RP',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);
  });

  // =====================
  // CREATE with retentionPeriod (multilingual)
  // =====================

  it('should create entity with retentionPeriod', async () => {
    const res = await ownerClient.post<BusinessEntityResponse>('/business-entities', {
      names: [{ locale: 'en', text: 'FE RP Create Entity' }],
      retentionPeriod: [{ locale: 'en', text: '5 years' }],
    });
    expect(res.status).toBe(201);
    expect(res.data.retentionPeriod).toEqual([{ locale: 'en', text: '5 years' }]);
  });

  it('should create entity without retentionPeriod (empty/null)', async () => {
    const entity = await createEntity(ownerClient, 'FE RP No Retention Entity');
    expect(entity.retentionPeriod == null || entity.retentionPeriod.length === 0).toBe(true);
  });

  // =====================
  // UPDATE retentionPeriod
  // =====================

  it('owner can update retentionPeriod', async () => {
    const entity = await createEntity(ownerClient, 'FE RP Updatable Entity');

    const res = await ownerClient.put<BusinessEntityResponse>(
      `/business-entities/${entity.key}/retention-period`,
      { retentionPeriod: [{ locale: 'en', text: '3 years' }] },
    );
    expect(res.status).toBe(200);
    expect(res.data.retentionPeriod).toEqual([{ locale: 'en', text: '3 years' }]);
  });

  it('admin can update retentionPeriod on any entity', async () => {
    const entity = await createEntity(ownerClient, 'FE RP Admin Update Entity');

    const res = await adminClient.put<BusinessEntityResponse>(
      `/business-entities/${entity.key}/retention-period`,
      { retentionPeriod: [{ locale: 'en', text: '10 years' }] },
    );
    expect(res.status).toBe(200);
    expect(res.data.retentionPeriod).toEqual([{ locale: 'en', text: '10 years' }]);
  });

  it('owner can clear retentionPeriod (set to empty/null)', async () => {
    const res = await ownerClient.post<BusinessEntityResponse>('/business-entities', {
      names: [{ locale: 'en', text: 'FE RP Clear Entity' }],
      retentionPeriod: [{ locale: 'en', text: '2 years' }],
    });
    const entityKey = res.data.key;

    const clearRes = await ownerClient.put<BusinessEntityResponse>(
      `/business-entities/${entityKey}/retention-period`,
      { retentionPeriod: null },
    );
    expect(clearRes.status).toBe(200);
    expect(clearRes.data.retentionPeriod == null || clearRes.data.retentionPeriod.length === 0).toBe(true);
  });

  it('non-owner cannot update retentionPeriod', async () => {
    const entity = await createEntity(ownerClient, 'FE RP Forbidden Entity');

    const res = await otherClient.put(
      `/business-entities/${entity.key}/retention-period`,
      { retentionPeriod: [{ locale: 'en', text: '7 years' }] },
    );
    expect(res.status).toBe(403);
  });

  // =====================
  // GET returns retentionPeriod
  // =====================

  it('GET entity returns retentionPeriod after update', async () => {
    const entity = await createEntity(ownerClient, 'FE RP Get Entity');
    await ownerClient.put(`/business-entities/${entity.key}/retention-period`, {
      retentionPeriod: [{ locale: 'en', text: '1 year' }],
    });

    const res = await ownerClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);
    expect(res.status).toBe(200);
    expect(res.data.retentionPeriod).toEqual([{ locale: 'en', text: '1 year' }]);
  });

  // =====================
  // Multilingual round-trip
  // =====================

  it('stores and returns retentionPeriod in multiple locales, and replaces the set on update', async () => {
    const entity = await createEntity(ownerClient, 'FE RP Multilingual Entity');

    // Create with two locales
    const twoLocales = await ownerClient.put<BusinessEntityResponse>(
      `/business-entities/${entity.key}/retention-period`,
      { retentionPeriod: [{ locale: 'en', text: '7 years' }, { locale: 'de', text: '7 Jahre' }] },
    );
    expect(twoLocales.status).toBe(200);
    const stored = twoLocales.data.retentionPeriod ?? [];
    expect(stored.find((x) => x.locale === 'en')?.text).toBe('7 years');
    expect(stored.find((x) => x.locale === 'de')?.text).toBe('7 Jahre');

    // Read back both locales
    const get = await ownerClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);
    const readBack = get.data.retentionPeriod ?? [];
    expect(readBack.find((x) => x.locale === 'en')?.text).toBe('7 years');
    expect(readBack.find((x) => x.locale === 'de')?.text).toBe('7 Jahre');

    // Update replaces the whole set (en-only) — de must be gone
    const replaced = await ownerClient.put<BusinessEntityResponse>(
      `/business-entities/${entity.key}/retention-period`,
      { retentionPeriod: [{ locale: 'en', text: '8 years' }] },
    );
    const after = replaced.data.retentionPeriod ?? [];
    expect(after.find((x) => x.locale === 'en')?.text).toBe('8 years');
    expect(after.find((x) => x.locale === 'de')).toBeUndefined();
  });
});
