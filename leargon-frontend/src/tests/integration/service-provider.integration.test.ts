import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createEntity,
  createProcess,
  createServiceProvider,
  ApiError,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { ServiceProviderResponse } from '@/api/generated/model/serviceProviderResponse';
import type { BusinessEntityResponse } from '@/api/generated/model/businessEntityResponse';
import type { ProcessResponse } from '@/api/generated/model/processResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Service Provider API', () => {
  let adminClient: AxiosInstance;
  let userClient: AxiosInstance;
  let adminToken: string;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    adminClient = createClient(baseUrl);
    userClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'sp-admin@example.com',
      username: 'spadmin',
      password: 'password123',
      firstName: 'SP',
      lastName: 'Admin',
    });
    adminToken = adminAuth.accessToken;
    withToken(adminClient, adminToken);

    const userAuth = await signup(userClient, {
      email: 'sp-user@example.com',
      username: 'spuser',
      password: 'password123',
      firstName: 'SP',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);
  });

  // ─── CREATE ────────────────────────────────────────────────────────────

  it('admin can create a service provider', async () => {
    const res = await adminClient.post<ServiceProviderResponse>('/service-providers', {
      names: [{ locale: 'en', text: 'AWS Integration' }],
      processingCountries: ['US', 'DE'],
      processorAgreementInPlace: true,
      subProcessorsApproved: true,
      serviceProviderType: 'DATA_PROCESSOR',
    });
    expect(res.status).toBe(201);
    expect(res.data.key).toBe('aws-integration');
    expect(res.data.names[0].text).toBe('AWS Integration');
    expect(res.data.processingCountries).toContain('US');
    expect(res.data.processorAgreementInPlace).toBe(true);
    expect(res.data.subProcessorsApproved).toBe(true);
    expect(res.data.serviceProviderType).toBe('DATA_PROCESSOR');
  });

  it('admin can create a service provider with BODYLEASE type', async () => {
    const res = await adminClient.post<ServiceProviderResponse>('/service-providers', {
      names: [{ locale: 'en', text: 'Staff Augmentation Partner' }],
      processingCountries: ['DE'],
      processorAgreementInPlace: false,
      subProcessorsApproved: false,
      serviceProviderType: 'BODYLEASE',
    });
    expect(res.status).toBe(201);
    expect(res.data.serviceProviderType).toBe('BODYLEASE');
  });

  it('non-admin cannot create a service provider', async () => {
    const res = await userClient.post('/service-providers', {
      names: [{ locale: 'en', text: 'Unauthorized Provider' }],
    });
    expect(res.status).toBe(403);
  });

  // ─── READ ──────────────────────────────────────────────────────────────

  it('authenticated user can list all service providers', async () => {
    await createServiceProvider(adminClient, 'List Test Provider A');
    await createServiceProvider(adminClient, 'List Test Provider B');

    const res = await userClient.get<ServiceProviderResponse[]>('/service-providers');
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThanOrEqual(2);
  });

  it('unauthenticated request is rejected', async () => {
    const anonClient = createClient(getBackendUrl());
    const res = await anonClient.get('/service-providers');
    expect(res.status).toBe(401);
  });

  it('can get service provider by key', async () => {
    const created = await createServiceProvider(adminClient, 'Stripe Billing');
    const res = await userClient.get<ServiceProviderResponse>(
      `/service-providers/${created.key}`,
    );
    expect(res.status).toBe(200);
    expect(res.data.key).toBe(created.key);
    expect(res.data.names[0].text).toBe('Stripe Billing');
  });

  it('returns 404 for non-existent service provider', async () => {
    const res = await userClient.get('/service-providers/non-existent-key');
    expect(res.status).toBe(404);
  });

  // ─── UPDATE ────────────────────────────────────────────────────────────

  it('admin can update a service provider', async () => {
    const created = await createServiceProvider(adminClient, 'Old Vendor Name');
    const res = await adminClient.put<ServiceProviderResponse>(
      `/service-providers/${created.key}`,
      {
        names: [{ locale: 'en', text: 'New Vendor Name' }],
        processingCountries: ['FR'],
        processorAgreementInPlace: false,
        subProcessorsApproved: true,
        serviceProviderType: 'MANAGED_SERVICE',
      },
    );
    expect(res.status).toBe(200);
    expect(res.data.names[0].text).toBe('New Vendor Name');
    expect(res.data.processingCountries).toContain('FR');
    expect(res.data.processorAgreementInPlace).toBe(false);
    expect(res.data.subProcessorsApproved).toBe(true);
    expect(res.data.serviceProviderType).toBe('MANAGED_SERVICE');
  });

  it('non-admin cannot update a service provider', async () => {
    const created = await createServiceProvider(adminClient, 'Protected Vendor');
    const res = await userClient.put(`/service-providers/${created.key}`, {
      names: [{ locale: 'en', text: 'Hacked' }],
      processingCountries: [],
      processorAgreementInPlace: false,
      subProcessorsApproved: false,
      serviceProviderType: 'OTHER',
    });
    expect(res.status).toBe(403);
  });

  // ─── DELETE ────────────────────────────────────────────────────────────

  it('admin can delete a service provider', async () => {
    const created = await createServiceProvider(adminClient, 'Deletable Vendor');
    const del = await adminClient.delete(`/service-providers/${created.key}`);
    expect(del.status).toBe(204);

    const get = await userClient.get(`/service-providers/${created.key}`);
    expect(get.status).toBe(404);
  });

  it('non-admin cannot delete a service provider', async () => {
    const created = await createServiceProvider(adminClient, 'Safe Vendor');
    const res = await userClient.delete(`/service-providers/${created.key}`);
    expect(res.status).toBe(403);
  });

  // ─── LINK PROCESSES ────────────────────────────────────────────────────

  it('admin can link processes to a service provider', async () => {
    const provider = await createServiceProvider(adminClient, 'Process Linker');
    const process = await createProcess(adminClient, 'SP Linked Process');

    const linkRes = await adminClient.put(
      `/service-providers/${provider.key}/linked-processes`,
      { processKeys: [process.key] },
    );
    expect(linkRes.status).toBe(204);

    const getProvider = await adminClient.get<ServiceProviderResponse>(
      `/service-providers/${provider.key}`,
    );
    expect(getProvider.data.linkedProcesses?.some((p) => p.key === process.key)).toBe(true);
  });

  // ─── CROSS-BORDER TRANSFERS ON ENTITY ──────────────────────────────────

  it('entity owner can update cross-border transfers', async () => {
    const entity = await createEntity(userClient, 'Transfer Test Entity');

    const res = await userClient.put<BusinessEntityResponse>(
      `/business-entities/${entity.key}/cross-border-transfers`,
      {
        transfers: [
          { destinationCountry: 'DE', safeguard: 'ADEQUACY_DECISION' },
          { destinationCountry: 'US', safeguard: 'STANDARD_CONTRACTUAL_CLAUSES', notes: 'SCCs in place' },
        ],
      },
    );
    expect(res.status).toBe(200);
    expect(res.data.crossBorderTransfers?.length).toBe(2);
    expect(
      res.data.crossBorderTransfers?.some(
        (t) => t.destinationCountry === 'DE' && t.safeguard === 'ADEQUACY_DECISION',
      ),
    ).toBe(true);
    expect(
      res.data.crossBorderTransfers?.some(
        (t) => t.destinationCountry === 'US' && t.notes === 'SCCs in place',
      ),
    ).toBe(true);
  });

  it('non-owner cannot update cross-border transfers on entity', async () => {
    const entity = await createEntity(adminClient, 'Admin Transfer Entity');

    const res = await userClient.put(
      `/business-entities/${entity.key}/cross-border-transfers`,
      { transfers: [] },
    );
    expect(res.status).toBe(403);
  });

  it('admin can update cross-border transfers on any entity', async () => {
    const entity = await createEntity(userClient, 'Any Transfer Entity');

    const res = await adminClient.put<BusinessEntityResponse>(
      `/business-entities/${entity.key}/cross-border-transfers`,
      { transfers: [{ destinationCountry: 'CH', safeguard: 'ADEQUACY_DECISION' }] },
    );
    expect(res.status).toBe(200);
    expect(res.data.crossBorderTransfers?.some((t) => t.destinationCountry === 'CH')).toBe(true);
  });

  // ─── CROSS-BORDER TRANSFERS ON PROCESS ─────────────────────────────────

  it('process owner can update cross-border transfers', async () => {
    const process = await createProcess(userClient, 'Transfer Test Process');

    const res = await userClient.put<ProcessResponse>(
      `/processes/${process.key}/cross-border-transfers`,
      {
        transfers: [
          { destinationCountry: 'US', safeguard: 'BINDING_CORPORATE_RULES' },
        ],
      },
    );
    expect(res.status).toBe(200);
    expect(res.data.crossBorderTransfers?.length).toBe(1);
    expect(
      res.data.crossBorderTransfers?.some(
        (t) => t.destinationCountry === 'US' && t.safeguard === 'BINDING_CORPORATE_RULES',
      ),
    ).toBe(true);
  });

  it('non-owner cannot update cross-border transfers on process', async () => {
    const process = await createProcess(adminClient, 'Admin Process Transfers');

    const res = await userClient.put(
      `/processes/${process.key}/cross-border-transfers`,
      { transfers: [] },
    );
    expect(res.status).toBe(403);
  });
});
