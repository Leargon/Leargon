import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createProcess,
  createServiceProvider,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { ServiceProviderResponse } from '@/api/generated/model/serviceProviderResponse';
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

  // ─── READ ──────────────────────────────────────────────────────────────

  it('authenticated user can list all service providers', async () => {
    await createServiceProvider(adminClient, 'List Test Provider A');
    await createServiceProvider(adminClient, 'List Test Provider B');

    const res = await userClient.get<ServiceProviderResponse[]>('/service-providers');
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThanOrEqual(2);
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

  // ─── DELETE ────────────────────────────────────────────────────────────

  it('admin can delete a service provider', async () => {
    const created = await createServiceProvider(adminClient, 'Deletable Vendor');
    const del = await adminClient.delete(`/service-providers/${created.key}`);
    expect(del.status).toBe(204);

    const get = await userClient.get(`/service-providers/${created.key}`);
    expect(get.status).toBe(404);
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

  // ─── REFERENTIAL INTEGRITY ─────────────────────────────────────────────

  it('delete service provider → linked processes still exist (not deleted)', async () => {
    const provider = await createServiceProvider(adminClient, 'Provider To Delete With Procs');
    const proc1 = await createProcess(adminClient, 'SP Surviving Process 1');
    const proc2 = await createProcess(adminClient, 'SP Surviving Process 2');

    await adminClient.put(`/service-providers/${provider.key}/linked-processes`, {
      processKeys: [proc1.key, proc2.key],
    });

    // Delete the service provider
    const delRes = await adminClient.delete(`/service-providers/${provider.key}`);
    expect(delRes.status).toBe(204);

    // Provider is gone
    const providerRes = await userClient.get(`/service-providers/${provider.key}`);
    expect(providerRes.status).toBe(404);

    // Processes still exist
    const p1Res = await userClient.get(`/processes/${proc1.key}`);
    expect(p1Res.status).toBe(200);

    const p2Res = await userClient.get(`/processes/${proc2.key}`);
    expect(p2Res.status).toBe(200);
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

});
