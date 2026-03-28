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
import type { CapabilityResponse } from '@/api/generated/model/capabilityResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

async function createCapability(
  client: AxiosInstance,
  name: string,
  extras?: Record<string, unknown>,
): Promise<CapabilityResponse> {
  const body = { names: [{ locale: 'en', text: name }], ...extras };
  const res = await client.post<CapabilityResponse>('/capabilities', body);
  if (res.status !== 201) throw new ApiError(res.status, res.data);
  return res.data;
}

describe('Capability API', () => {
  let adminClient: AxiosInstance;
  let userClient: AxiosInstance;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    adminClient = createClient(baseUrl);
    userClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'cap-admin@example.com',
      username: 'capadmin',
      password: 'password123',
      firstName: 'Cap',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const userAuth = await signup(userClient, {
      email: 'cap-user@example.com',
      username: 'capuser',
      password: 'password123',
      firstName: 'Cap',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);
  });

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  it('admin can create a capability', async () => {
    const res = await adminClient.post<CapabilityResponse>('/capabilities', {
      names: [{ locale: 'en', text: 'Customer Management' }],
      descriptions: [{ locale: 'en', text: 'Manage customer data and interactions' }],
    });

    expect(res.status).toBe(201);
    expect(res.data.key).toBeTruthy();
    expect(res.data.names[0].text).toBe('Customer Management');
    expect(res.data.parent ?? null).toBeNull();
  });

  it('non-admin cannot create a capability', async () => {
    const res = await userClient.post('/capabilities', {
      names: [{ locale: 'en', text: 'Forbidden Cap' }],
    });
    expect(res.status).toBe(403);
  });

  it('can get all capabilities', async () => {
    await createCapability(adminClient, 'List Test Cap');
    const res = await userClient.get<CapabilityResponse[]>('/capabilities');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(1);
  });

  it('can get a capability by key', async () => {
    const cap = await createCapability(adminClient, 'Get By Key Cap');
    const res = await userClient.get<CapabilityResponse>(`/capabilities/${cap.key}`);

    expect(res.status).toBe(200);
    expect(res.data.key).toBe(cap.key);
    expect(res.data.names[0].text).toBe('Get By Key Cap');
  });

  it('returns 404 for unknown capability key', async () => {
    const res = await userClient.get('/capabilities/nonexistent-capability-key');
    expect(res.status).toBe(404);
  });

  it('admin can update a capability', async () => {
    const cap = await createCapability(adminClient, 'Original Cap Name');

    const res = await adminClient.put<CapabilityResponse>(`/capabilities/${cap.key}`, {
      names: [{ locale: 'en', text: 'Renamed Cap' }],
    });

    expect(res.status).toBe(200);
    expect(res.data.names[0].text).toBe('Renamed Cap');
  });

  it('non-admin cannot update a capability', async () => {
    const cap = await createCapability(adminClient, 'No Update Cap');
    const res = await userClient.put(`/capabilities/${cap.key}`, {
      names: [{ locale: 'en', text: 'Hacked' }],
    });
    expect(res.status).toBe(403);
  });

  it('admin can delete a capability', async () => {
    const cap = await createCapability(adminClient, 'Delete Me Cap');
    const del = await adminClient.delete(`/capabilities/${cap.key}`);
    expect(del.status).toBe(204);

    const get = await userClient.get(`/capabilities/${cap.key}`);
    expect(get.status).toBe(404);
  });

  it('non-admin cannot delete a capability', async () => {
    const cap = await createCapability(adminClient, 'Protected Cap');
    const res = await userClient.delete(`/capabilities/${cap.key}`);
    expect(res.status).toBe(403);
  });

  // ─── Hierarchy ────────────────────────────────────────────────────────────

  it('can create a child capability', async () => {
    const parent = await createCapability(adminClient, 'Parent Capability');
    const child = await createCapability(adminClient, 'Child Capability', {
      parentCapabilityKey: parent.key,
    });

    expect(child.parent?.key).toBe(parent.key);
    expect(child.parent?.name).toBe('Parent Capability');
  });

  it('parent capability shows children', async () => {
    const parent = await createCapability(adminClient, 'Parent With Children');
    await createCapability(adminClient, 'Child A', { parentCapabilityKey: parent.key });
    await createCapability(adminClient, 'Child B', { parentCapabilityKey: parent.key });

    const res = await userClient.get<CapabilityResponse>(`/capabilities/${parent.key}`);

    expect(res.status).toBe(200);
    expect(res.data.children).toHaveLength(2);
    const childNames = res.data.children!.map((c) => c.name);
    expect(childNames).toContain('Child A');
    expect(childNames).toContain('Child B');
  });

  it('can move a capability to a new parent', async () => {
    const parent1 = await createCapability(adminClient, 'Parent One');
    const parent2 = await createCapability(adminClient, 'Parent Two');
    const child = await createCapability(adminClient, 'Movable Child', {
      parentCapabilityKey: parent1.key,
    });

    const res = await adminClient.put<CapabilityResponse>(`/capabilities/${child.key}`, {
      names: [{ locale: 'en', text: 'Movable Child' }],
      parentCapabilityKey: parent2.key,
    });

    expect(res.status).toBe(200);
    expect(res.data.parent?.key).toBe(parent2.key);
  });

  it('can make a child capability top-level by setting parent to null', async () => {
    const parent = await createCapability(adminClient, 'Temp Parent');
    const child = await createCapability(adminClient, 'Soon Top-Level', {
      parentCapabilityKey: parent.key,
    });

    const res = await adminClient.put<CapabilityResponse>(`/capabilities/${child.key}`, {
      names: [{ locale: 'en', text: 'Soon Top-Level' }],
      parentCapabilityKey: null,
    });

    expect(res.status).toBe(200);
    expect(res.data.parent ?? null).toBeNull();
  });

  // ─── Owning Unit ─────────────────────────────────────────────────────────

  it('can assign an owning unit to a capability', async () => {
    const unit = await createOrgUnit(adminClient, 'Cap Owning Unit');
    const cap = await createCapability(adminClient, 'Owned Capability');

    const res = await adminClient.put<CapabilityResponse>(`/capabilities/${cap.key}`, {
      names: [{ locale: 'en', text: 'Owned Capability' }],
      owningUnitKey: unit.key,
    });

    expect(res.status).toBe(200);
    expect(res.data.owningUnit?.key).toBe(unit.key);
    expect(res.data.owningUnit?.name).toBe('Cap Owning Unit');
  });

  it('can clear the owning unit from a capability', async () => {
    const unit = await createOrgUnit(adminClient, 'Cap Owning Unit To Clear');
    const cap = await createCapability(adminClient, 'Unowned Cap', {
      // No owningUnitKey here in create
    });

    // First assign
    await adminClient.put(`/capabilities/${cap.key}`, {
      names: [{ locale: 'en', text: 'Unowned Cap' }],
      owningUnitKey: unit.key,
    });

    // Then clear
    const res = await adminClient.put<CapabilityResponse>(`/capabilities/${cap.key}`, {
      names: [{ locale: 'en', text: 'Unowned Cap' }],
      owningUnitKey: null,
    });

    expect(res.status).toBe(200);
    expect(res.data.owningUnit ?? null).toBeNull();
  });

  it('returns 404 when assigning a non-existent owning unit', async () => {
    const cap = await createCapability(adminClient, 'Bad Unit Cap');

    const res = await adminClient.put(`/capabilities/${cap.key}`, {
      names: [{ locale: 'en', text: 'Bad Unit Cap' }],
      owningUnitKey: 'does-not-exist',
    });

    expect(res.status).toBe(404);
  });

  // ─── Linked Processes ─────────────────────────────────────────────────────

  it('can link processes to a capability', async () => {
    const cap = await createCapability(adminClient, 'Process Linked Cap');
    const proc1 = await createProcess(adminClient, 'Cap Process 1');
    const proc2 = await createProcess(adminClient, 'Cap Process 2');

    const res = await adminClient.put<CapabilityResponse>(
      `/capabilities/${cap.key}/linked-processes`,
      { processKeys: [proc1.key, proc2.key] },
    );

    expect(res.status).toBe(204);
    // 204 returns no body — verify via GET
    const getRes = await adminClient.get<CapabilityResponse>(`/capabilities/${cap.key}`);
    expect(getRes.data.linkedProcesses).toHaveLength(2);
    const processKeys = getRes.data.linkedProcesses!.map((p) => p.key);
    expect(processKeys).toContain(proc1.key);
    expect(processKeys).toContain(proc2.key);
  });

  it('can clear linked processes from a capability', async () => {
    const cap = await createCapability(adminClient, 'Cap To Clear Procs');
    const proc = await createProcess(adminClient, 'Cap Proc To Clear');

    await adminClient.put(`/capabilities/${cap.key}/linked-processes`, {
      processKeys: [proc.key],
    });

    const res = await adminClient.put<CapabilityResponse>(
      `/capabilities/${cap.key}/linked-processes`,
      { processKeys: [] },
    );

    expect(res.status).toBe(204);
    const clearGetRes = await adminClient.get<CapabilityResponse>(`/capabilities/${cap.key}`);
    expect(clearGetRes.data.linkedProcesses ?? []).toHaveLength(0);
  });
});
