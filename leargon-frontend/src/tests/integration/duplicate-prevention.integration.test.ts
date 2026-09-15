import { describe, it, expect, beforeAll } from 'vitest';
import type { AxiosInstance } from 'axios';
import { createClient, signupAdmin, withToken, createDomain } from './testClient';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

const names = (text: string) => [{ locale: 'en', text }];
const JUSTIFICATION = [{ locale: 'en', text: 'Different lifecycle and owner than the existing one' }];

/**
 * Duplicate prevention: a likely duplicate in the same bounded context is refused (409
 * DUPLICATE_CANDIDATES) unless justified and acknowledged; the same name in another context is allowed
 * and the preview suggests a translation link.
 */
describe('Duplicate prevention', () => {
  let admin: AxiosInstance;
  let billing: string;
  let shipping: string;
  let existingKey: string;

  beforeAll(async () => {
    admin = createClient(getBackendUrl());
    const auth = await signupAdmin(admin, {
      email: 'dp-admin@example.com', username: 'dpadmin', password: 'password123', firstName: 'DP', lastName: 'Admin',
    });
    withToken(admin, auth.accessToken);

    const domain = (await createDomain(admin, 'DP Sales')).key;
    billing = (await admin.post(`/business-domains/${domain}/bounded-contexts`, { names: names('DP Billing') })).data.key;
    shipping = (await admin.post(`/business-domains/${domain}/bounded-contexts`, { names: names('DP Shipping') })).data.key;
    const existing = await admin.post('/business-entities', { names: names('DP Customer'), boundedContextKey: billing });
    expect(existing.status).toBe(201);
    existingKey = existing.data.key;
  });

  it('refuses a same-named entity in the same bounded context and returns the candidates', async () => {
    const res = await admin.post('/business-entities', { names: names('DP Customer'), boundedContextKey: billing });
    expect(res.status).toBe(409);
    expect(res.data.errorCode).toBe('DUPLICATE_CANDIDATES');
    expect(res.data.duplicateCandidates.map((c: { key: string }) => c.key)).toContain(existingKey);
  });

  it('refuses a justification without acknowledgement, and an acknowledgement without justification', async () => {
    const base = { names: names('DP Customer'), boundedContextKey: billing };
    expect((await admin.post('/business-entities', { ...base, duplicateJustification: JUSTIFICATION })).status).toBe(409);
    expect((await admin.post('/business-entities', { ...base, acknowledgedDuplicateKeys: [existingKey] })).status).toBe(409);
  });

  it('creates a justified and acknowledged duplicate with a distinct key', async () => {
    const res = await admin.post('/business-entities', {
      names: names('DP Customer'),
      boundedContextKey: billing,
      duplicateJustification: JUSTIFICATION,
      acknowledgedDuplicateKeys: [existingKey],
    });
    expect(res.status).toBe(201);
    expect(res.data.key).not.toBe(existingKey);
  });

  it('allows the same name in another bounded context and suggests a translation link', async () => {
    const preview = await admin.post('/creation/duplicate-candidates', {
      itemType: 'BUSINESS_ENTITY',
      names: names('DP Customer'),
      boundedContextKey: shipping,
    });
    expect(preview.status).toBe(200);
    expect(preview.data.blocking).toBe(false);
    const candidate = preview.data.candidates.find((c: { key: string }) => c.key === existingKey);
    expect(candidate).toMatchObject({ blocking: false, scope: 'ELSEWHERE', suggestion: 'TRANSLATION_LINK' });

    const created = await admin.post('/business-entities', { names: names('DP Customer'), boundedContextKey: shipping });
    expect(created.status).toBe(201);
  });
});
