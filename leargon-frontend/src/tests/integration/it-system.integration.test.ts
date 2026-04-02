import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createOrgUnit,
  createProcess,
  ApiError,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { ItSystemResponse } from '@/api/generated/model/itSystemResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

async function createItSystem(
  client: AxiosInstance,
  name: string,
  extras?: Record<string, unknown>,
): Promise<ItSystemResponse> {
  const body = { names: [{ locale: 'en', text: name }], ...extras };
  const res = await client.post<ItSystemResponse>('/it-systems', body);
  if (res.status !== 201) throw new ApiError(res.status, res.data);
  return res.data;
}

describe('IT System API', () => {
  let adminClient: AxiosInstance;
  let userClient: AxiosInstance;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    adminClient = createClient(baseUrl);
    userClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'its-admin@example.com',
      username: 'itsadmin',
      password: 'password123',
      firstName: 'ITS',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const userAuth = await signup(userClient, {
      email: 'its-user@example.com',
      username: 'itsuser',
      password: 'password123',
      firstName: 'ITS',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);
  });

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  it('admin can create an IT system', async () => {
    const res = await adminClient.post<ItSystemResponse>('/it-systems', {
      names: [{ locale: 'en', text: 'SAP ERP' }],
      descriptions: [{ locale: 'en', text: 'Core ERP system' }],
      vendor: 'SAP SE',
      systemUrl: 'https://sap.example.com',
    });

    expect(res.status).toBe(201);
    expect(res.data.key).toBeTruthy();
    expect(res.data.names[0].text).toBe('SAP ERP');
    expect(res.data.vendor).toBe('SAP SE');
    expect(res.data.systemUrl).toBe('https://sap.example.com');
    expect(res.data.owningUnit ?? null).toBeNull();
  });

  it('can get all IT systems', async () => {
    await createItSystem(adminClient, 'List Test System');
    const res = await userClient.get<ItSystemResponse[]>('/it-systems');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(1);
  });

  it('can get an IT system by key', async () => {
    const sys = await createItSystem(adminClient, 'Get By Key System');
    const res = await userClient.get<ItSystemResponse>(`/it-systems/${sys.key}`);

    expect(res.status).toBe(200);
    expect(res.data.key).toBe(sys.key);
    expect(res.data.names[0].text).toBe('Get By Key System');
  });

  it('returns 404 for unknown IT system key', async () => {
    const res = await userClient.get('/it-systems/nonexistent-system-key');
    expect(res.status).toBe(404);
  });

  it('admin can update an IT system', async () => {
    const sys = await createItSystem(adminClient, 'Old System Name');

    const res = await adminClient.put<ItSystemResponse>(`/it-systems/${sys.key}`, {
      names: [{ locale: 'en', text: 'Renamed System' }],
      vendor: 'New Vendor',
      systemUrl: 'https://new-vendor.example.com',
    });

    expect(res.status).toBe(200);
    expect(res.data.names[0].text).toBe('Renamed System');
    expect(res.data.vendor).toBe('New Vendor');
  });

  it('admin can delete an IT system', async () => {
    const sys = await createItSystem(adminClient, 'Delete Me System');
    const del = await adminClient.delete(`/it-systems/${sys.key}`);
    expect(del.status).toBe(204);

    const get = await userClient.get(`/it-systems/${sys.key}`);
    expect(get.status).toBe(404);
  });

  // ─── Owning Unit ──────────────────────────────────────────────────────────

  it('can assign an owning unit to an IT system', async () => {
    const unit = await createOrgUnit(adminClient, 'ITS Owning Unit');
    const sys = await createItSystem(adminClient, 'Owned IT System');

    const res = await adminClient.put<ItSystemResponse>(`/it-systems/${sys.key}`, {
      names: [{ locale: 'en', text: 'Owned IT System' }],
      owningUnitKey: unit.key,
    });

    expect(res.status).toBe(200);
    expect(res.data.owningUnit?.key).toBe(unit.key);
    expect(res.data.owningUnit?.name).toBe('ITS Owning Unit');
  });

  it('can clear the owning unit from an IT system', async () => {
    const unit = await createOrgUnit(adminClient, 'ITS Unit To Clear');
    const sys = await createItSystem(adminClient, 'Temp Owned System');

    // First assign
    await adminClient.put(`/it-systems/${sys.key}`, {
      names: [{ locale: 'en', text: 'Temp Owned System' }],
      owningUnitKey: unit.key,
    });

    // Then clear
    const res = await adminClient.put<ItSystemResponse>(`/it-systems/${sys.key}`, {
      names: [{ locale: 'en', text: 'Temp Owned System' }],
      owningUnitKey: null,
    });

    expect(res.status).toBe(200);
    expect(res.data.owningUnit ?? null).toBeNull();
  });

  it('returns 404 when assigning a non-existent owning unit', async () => {
    const sys = await createItSystem(adminClient, 'Bad Unit System');

    const res = await adminClient.put(`/it-systems/${sys.key}`, {
      names: [{ locale: 'en', text: 'Bad Unit System' }],
      owningUnitKey: 'does-not-exist',
    });

    expect(res.status).toBe(404);
  });

  // ─── Linked Processes ──────────────────────────────────────────────────────

  it('can link processes to an IT system', async () => {
    const sys = await createItSystem(adminClient, 'Process Linked System');
    const proc1 = await createProcess(adminClient, 'ITS Process 1');
    const proc2 = await createProcess(adminClient, 'ITS Process 2');

    const res = await adminClient.put<ItSystemResponse>(
      `/it-systems/${sys.key}/linked-processes`,
      { processKeys: [proc1.key, proc2.key] },
    );

    expect(res.status).toBe(204);
    const getRes = await adminClient.get<ItSystemResponse>(`/it-systems/${sys.key}`);
    expect(getRes.data.linkedProcesses).toHaveLength(2);
    const processKeys = getRes.data.linkedProcesses!.map((p) => p.key);
    expect(processKeys).toContain(proc1.key);
    expect(processKeys).toContain(proc2.key);
  });

  it('delete IT system → linked processes still exist (not deleted)', async () => {
    const sys = await createItSystem(adminClient, 'System To Delete With Procs');
    const proc1 = await createProcess(adminClient, 'ITS Surviving Process 1');
    const proc2 = await createProcess(adminClient, 'ITS Surviving Process 2');

    await adminClient.put(`/it-systems/${sys.key}/linked-processes`, {
      processKeys: [proc1.key, proc2.key],
    });

    // Delete the IT system
    const delRes = await adminClient.delete(`/it-systems/${sys.key}`);
    expect(delRes.status).toBe(204);

    // System is gone
    const sysRes = await userClient.get(`/it-systems/${sys.key}`);
    expect(sysRes.status).toBe(404);

    // Processes still exist
    const p1Res = await userClient.get(`/processes/${proc1.key}`);
    expect(p1Res.status).toBe(200);

    const p2Res = await userClient.get(`/processes/${proc2.key}`);
    expect(p2Res.status).toBe(200);
  });

  it('can clear linked processes from an IT system', async () => {
    const sys = await createItSystem(adminClient, 'System To Clear Procs');
    const proc = await createProcess(adminClient, 'ITS Proc To Clear');

    await adminClient.put(`/it-systems/${sys.key}/linked-processes`, {
      processKeys: [proc.key],
    });

    const res = await adminClient.put<ItSystemResponse>(
      `/it-systems/${sys.key}/linked-processes`,
      { processKeys: [] },
    );

    expect(res.status).toBe(204);
    const clearGetRes = await adminClient.get<ItSystemResponse>(`/it-systems/${sys.key}`);
    expect(clearGetRes.data.linkedProcesses ?? []).toHaveLength(0);
  });
});
