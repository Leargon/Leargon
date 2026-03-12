import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createEntity,
  createProcess,
  createDataProcessor,
  ApiError,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { DataProcessorResponse } from '@/api/generated/model/dataProcessorResponse';
import type { BusinessEntityResponse } from '@/api/generated/model/businessEntityResponse';
import type { ProcessResponse } from '@/api/generated/model/processResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Data Processor API', () => {
  let adminClient: AxiosInstance;
  let userClient: AxiosInstance;
  let adminToken: string;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    adminClient = createClient(baseUrl);
    userClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'dp-admin@example.com',
      username: 'dpadmin',
      password: 'password123',
      firstName: 'DP',
      lastName: 'Admin',
    });
    adminToken = adminAuth.accessToken;
    withToken(adminClient, adminToken);

    const userAuth = await signup(userClient, {
      email: 'dp-user@example.com',
      username: 'dpuser',
      password: 'password123',
      firstName: 'DP',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);
  });

  // ─── CREATE ────────────────────────────────────────────────────────────

  it('admin can create a data processor', async () => {
    const res = await adminClient.post<DataProcessorResponse>('/data-processors', {
      names: [{ locale: 'en', text: 'AWS Integration' }],
      processingCountries: ['US', 'DE'],
      processorAgreementInPlace: true,
      subProcessorsApproved: true,
    });
    expect(res.status).toBe(201);
    expect(res.data.key).toBe('aws-integration');
    expect(res.data.names[0].text).toBe('AWS Integration');
    expect(res.data.processingCountries).toContain('US');
    expect(res.data.processorAgreementInPlace).toBe(true);
    expect(res.data.subProcessorsApproved).toBe(true);
  });

  it('non-admin cannot create a data processor', async () => {
    const res = await userClient.post('/data-processors', {
      names: [{ locale: 'en', text: 'Unauthorized Processor' }],
    });
    expect(res.status).toBe(403);
  });

  // ─── READ ──────────────────────────────────────────────────────────────

  it('authenticated user can list all data processors', async () => {
    await createDataProcessor(adminClient, 'List Test Processor A');
    await createDataProcessor(adminClient, 'List Test Processor B');

    const res = await userClient.get<DataProcessorResponse[]>('/data-processors');
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThanOrEqual(2);
  });

  it('unauthenticated request is rejected', async () => {
    const anonClient = createClient(getBackendUrl());
    const res = await anonClient.get('/data-processors');
    expect(res.status).toBe(401);
  });

  it('can get data processor by key', async () => {
    const created = await createDataProcessor(adminClient, 'Stripe Billing');
    const res = await userClient.get<DataProcessorResponse>(
      `/data-processors/${created.key}`,
    );
    expect(res.status).toBe(200);
    expect(res.data.key).toBe(created.key);
    expect(res.data.names[0].text).toBe('Stripe Billing');
  });

  it('returns 404 for non-existent processor', async () => {
    const res = await userClient.get('/data-processors/non-existent-key');
    expect(res.status).toBe(404);
  });

  // ─── UPDATE ────────────────────────────────────────────────────────────

  it('admin can update a data processor', async () => {
    const created = await createDataProcessor(adminClient, 'Old Vendor Name');
    const res = await adminClient.put<DataProcessorResponse>(
      `/data-processors/${created.key}`,
      {
        names: [{ locale: 'en', text: 'New Vendor Name' }],
        processingCountries: ['FR'],
        processorAgreementInPlace: false,
        subProcessorsApproved: true,
      },
    );
    expect(res.status).toBe(200);
    expect(res.data.names[0].text).toBe('New Vendor Name');
    expect(res.data.processingCountries).toContain('FR');
    expect(res.data.processorAgreementInPlace).toBe(false);
    expect(res.data.subProcessorsApproved).toBe(true);
  });

  it('non-admin cannot update a data processor', async () => {
    const created = await createDataProcessor(adminClient, 'Protected Vendor');
    const res = await userClient.put(`/data-processors/${created.key}`, {
      names: [{ locale: 'en', text: 'Hacked' }],
      processingCountries: [],
      processorAgreementInPlace: false,
      subProcessorsApproved: false,
    });
    expect(res.status).toBe(403);
  });

  // ─── DELETE ────────────────────────────────────────────────────────────

  it('admin can delete a data processor', async () => {
    const created = await createDataProcessor(adminClient, 'Deletable Vendor');
    const del = await adminClient.delete(`/data-processors/${created.key}`);
    expect(del.status).toBe(204);

    const get = await userClient.get(`/data-processors/${created.key}`);
    expect(get.status).toBe(404);
  });

  it('non-admin cannot delete a data processor', async () => {
    const created = await createDataProcessor(adminClient, 'Safe Vendor');
    const res = await userClient.delete(`/data-processors/${created.key}`);
    expect(res.status).toBe(403);
  });

  // ─── LINK ENTITIES ─────────────────────────────────────────────────────

  it('admin can link business entities to a processor', async () => {
    const processor = await createDataProcessor(adminClient, 'Entity Linker');
    const entity = await createEntity(adminClient, 'DP Linked Entity');

    const linkRes = await adminClient.put(
      `/data-processors/${processor.key}/linked-entities`,
      { businessEntityKeys: [entity.key] },
    );
    expect(linkRes.status).toBe(204);

    // Processor should reference the entity
    const getProcessor = await adminClient.get<DataProcessorResponse>(
      `/data-processors/${processor.key}`,
    );
    expect(getProcessor.data.linkedBusinessEntities?.some((e) => e.key === entity.key)).toBe(true);

    // Entity response should reference the processor
    const getEntity = await userClient.get<BusinessEntityResponse>(
      `/business-entities/${entity.key}`,
    );
    expect(getEntity.data.dataProcessors?.some((p) => p.key === processor.key)).toBe(true);
  });

  it('non-admin cannot link entities to a processor', async () => {
    const processor = await createDataProcessor(adminClient, 'Locked Processor');
    const res = await userClient.put(
      `/data-processors/${processor.key}/linked-entities`,
      { businessEntityKeys: [] },
    );
    expect(res.status).toBe(403);
  });

  // ─── LINK PROCESSES ────────────────────────────────────────────────────

  it('admin can link processes to a processor', async () => {
    const processor = await createDataProcessor(adminClient, 'Process Linker');
    const process = await createProcess(adminClient, 'DP Linked Process');

    const linkRes = await adminClient.put(
      `/data-processors/${processor.key}/linked-processes`,
      { processKeys: [process.key] },
    );
    expect(linkRes.status).toBe(204);

    const getProcessor = await adminClient.get<DataProcessorResponse>(
      `/data-processors/${processor.key}`,
    );
    expect(getProcessor.data.linkedProcesses?.some((p) => p.key === process.key)).toBe(true);
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
