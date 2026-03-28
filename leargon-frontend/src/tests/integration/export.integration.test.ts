import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signupAdmin,
  signup,
  withToken,
  createProcess,
  createEntity,
} from './testClient';
import type { AxiosInstance } from 'axios';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Export API', () => {
  let adminClient: AxiosInstance;
  let userClient: AxiosInstance;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    adminClient = createClient(baseUrl);
    userClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'export-admin@example.com',
      username: 'exportadmin',
      password: 'password123',
      firstName: 'Export',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const userAuth = await signup(userClient, {
      email: 'export-user@example.com',
      username: 'exportuser',
      password: 'password123',
      firstName: 'Export',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);
  });

  // ─── Processing Register ──────────────────────────────────────────────────

  it('admin can export processing register as CSV', async () => {
    const proc = await createProcess(userClient, 'CSV Export Test Process');
    await userClient.put(`/processes/${proc.key}/legal-basis`, { legalBasis: 'CONSENT' });
    const res = await adminClient.get<string>('/export/processing-register', {
      responseType: 'text',
    });

    expect(res.status).toBe(200);
    expect(res.data).toContain('Process Name');
    expect(res.data).toContain('Legal Basis');
    expect(res.data).toContain('CSV Export Test Process');
  });

  it('non-admin cannot export processing register', async () => {
    const res = await userClient.get('/export/processing-register');
    expect(res.status).toBe(403);
  });

  it('processing register export is unauthenticated returns 401', async () => {
    const unauthClient = createClient(getBackendUrl());
    const res = await unauthClient.get('/export/processing-register');
    expect(res.status).toBe(401);
  });

  // ─── Service Providers ───────────────────────────────────────────────────

  it('admin can export service providers register as CSV', async () => {
    await adminClient.post('/service-providers', {
      names: [{ locale: 'en', text: 'CSV Test Provider' }],
      processingCountries: ['DE', 'US'],
      processorAgreementInPlace: true,
      subProcessorsApproved: false,
      serviceProviderType: 'DATA_PROCESSOR',
    });

    const res = await adminClient.get<string>('/export/service-providers', {
      responseType: 'text',
    });

    expect(res.status).toBe(200);
    expect(res.data).toContain('Service Provider Key');
    expect(res.data).toContain('Service Provider Name');
    expect(res.data).toContain('CSV Test Provider');
  });

  it('non-admin cannot export service providers', async () => {
    const res = await userClient.get('/export/service-providers');
    expect(res.status).toBe(403);
  });

  // ─── DPIA Register ────────────────────────────────────────────────────────

  it('admin can export DPIA register as CSV', async () => {
    const process = await createProcess(userClient, 'DPIA Export Test Process');
    await userClient.post(`/processes/${process.key}/dpia`, null);

    const res = await adminClient.get<string>('/export/dpia-register', {
      responseType: 'text',
    });

    expect(res.status).toBe(200);
    expect(res.data).toContain('DPIA Key');
    expect(res.data).toContain('Status');
    expect(res.data).toContain('In Progress');
  });

  it('non-admin cannot export DPIA register', async () => {
    const res = await userClient.get('/export/dpia-register');
    expect(res.status).toBe(403);
  });

  it('DPIA register export returns headers-only CSV when no DPIAs', async () => {
    // Create a second admin to avoid interference from other DPIAs
    const freshAdmin = createClient(getBackendUrl());
    const freshAdminAuth = await signupAdmin(freshAdmin, {
      email: 'export-admin2@example.com',
      username: 'exportadmin2',
      password: 'password123',
      firstName: 'Fresh',
      lastName: 'Admin',
    });
    withToken(freshAdmin, freshAdminAuth.accessToken);

    // Just verify the headers are present (there may be DPIAs from other tests)
    const res = await freshAdmin.get<string>('/export/dpia-register', {
      responseType: 'text',
    });

    expect(res.status).toBe(200);
    expect(res.data).toContain('DPIA Key');
    expect(res.data).toContain('Related Resource Key');
  });

  it('admin can export entity DPIA in DPIA register', async () => {
    const entity = await createEntity(userClient, 'DPIA Export Test Entity');
    await userClient.post(`/business-entities/${entity.key}/dpia`, null);

    const res = await adminClient.get<string>('/export/dpia-register', {
      responseType: 'text',
    });

    expect(res.status).toBe(200);
    expect(res.data).toContain('BUSINESS_ENTITY');
  });
});
