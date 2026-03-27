import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createEntity,
  createProcess,
} from './testClient';
import type { AxiosInstance } from 'axios';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Dashboard API', () => {
  let userClient: AxiosInstance;
  let adminClient: AxiosInstance;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    userClient = createClient(baseUrl);
    adminClient = createClient(baseUrl);

    const userAuth = await signup(userClient, {
      email: 'dashboard-user@example.com',
      username: 'dashboarduser',
      password: 'password123',
      firstName: 'Dashboard',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'dashboard-admin@example.com',
      username: 'dashboardadmin',
      password: 'password123',
      firstName: 'Dashboard',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);
  });

  // ─── Auth guards ───────────────────────────────────────────────────────────

  it('GET /dashboard returns 401 without authentication', async () => {
    const client = createClient(getBackendUrl());
    const res = await client.get('/dashboard');
    expect(res.status).toBe(401);
  });

  it('GET /dashboard/maturity returns 401 without authentication', async () => {
    const client = createClient(getBackendUrl());
    const res = await client.get('/dashboard/maturity');
    expect(res.status).toBe(401);
  });

  // ─── Role guard ────────────────────────────────────────────────────────────

  it('GET /dashboard/maturity returns 403 for regular user', async () => {
    const res = await userClient.get('/dashboard/maturity');
    expect(res.status).toBe(403);
  });

  // ─── Dashboard response shape ─────────────────────────────────────────────

  it('GET /dashboard returns 200 with required fields', async () => {
    const res = await userClient.get('/dashboard');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('needsAttention');
    expect(res.data).toHaveProperty('recentActivity');
    expect(res.data).toHaveProperty('myResponsibilities');
    expect(res.data.myResponsibilities).toHaveProperty('entities');
    expect(res.data.myResponsibilities).toHaveProperty('processes');
  });

  // ─── My Responsibilities ──────────────────────────────────────────────────

  it('myResponsibilities includes entities owned by the current user', async () => {
    await createEntity(userClient, 'DashboardIntOwnedEntity');

    const res = await userClient.get('/dashboard');
    expect(res.status).toBe(200);

    const entities: Array<{ key: string; name: string }> =
      res.data.myResponsibilities.entities ?? [];
    const found = entities.find((e) => e.name === 'DashboardIntOwnedEntity');
    expect(found).toBeDefined();
  });

  it('myResponsibilities includes processes owned by the current user', async () => {
    await createProcess(userClient, 'DashboardIntOwnedProcess');

    const res = await userClient.get('/dashboard');
    expect(res.status).toBe(200);

    const processes: Array<{ key: string; name: string }> =
      res.data.myResponsibilities.processes ?? [];
    const found = processes.find((p) => p.name === 'DashboardIntOwnedProcess');
    expect(found).toBeDefined();
  });

  // ─── Recent activity ──────────────────────────────────────────────────────

  it('recentActivity contains entries after creating resources', async () => {
    await createEntity(userClient, 'DashboardIntActivityEntity');

    const res = await userClient.get('/dashboard');
    expect(res.status).toBe(200);

    const activity: Array<{ resourceType: string }> = res.data.recentActivity ?? [];
    expect(activity.length).toBeGreaterThanOrEqual(1);
    expect(activity.some((a) => a.resourceType === 'ENTITY')).toBe(true);
  });

  it('recentActivity items have required fields', async () => {
    const res = await userClient.get('/dashboard');
    expect(res.status).toBe(200);

    const activity: Array<Record<string, unknown>> = res.data.recentActivity ?? [];
    if (activity.length > 0) {
      const item = activity[0];
      expect(item).toHaveProperty('resourceType');
      expect(item).toHaveProperty('resourceKey');
      expect(item).toHaveProperty('resourceName');
      expect(item).toHaveProperty('changeType');
      expect(item).toHaveProperty('changedAt');
    }
  });

  // ─── Maturity metrics ─────────────────────────────────────────────────────

  it('GET /dashboard/maturity returns 200 for admin', async () => {
    const res = await adminClient.get('/dashboard/maturity');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('metrics');
  });

  it('GET /dashboard/maturity returns exactly 7 metric items', async () => {
    const res = await adminClient.get('/dashboard/maturity');
    expect(res.status).toBe(200);
    expect((res.data.metrics as unknown[]).length).toBe(7);
  });

  it('maturity metric items have required fields', async () => {
    const res = await adminClient.get('/dashboard/maturity');
    expect(res.status).toBe(200);

    const metrics = res.data.metrics as Array<Record<string, unknown>>;
    metrics.forEach((item) => {
      expect(item).toHaveProperty('key');
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('covered');
      expect(item).toHaveProperty('total');
      expect(item).toHaveProperty('percentage');
      expect(item.percentage as number).toBeGreaterThanOrEqual(0);
      expect(item.percentage as number).toBeLessThanOrEqual(100);
    });
  });

  it('maturity metrics report 100 percent when total is 0', async () => {
    const res = await adminClient.get('/dashboard/maturity');
    expect(res.status).toBe(200);

    const metrics = res.data.metrics as Array<{ total: number; percentage: number }>;
    metrics
      .filter((m) => m.total === 0)
      .forEach((m) => {
        expect(m.percentage).toBe(100);
      });
  });

  it('maturity metrics include known metric keys', async () => {
    const res = await adminClient.get('/dashboard/maturity');
    expect(res.status).toBe(200);

    const keys = (res.data.metrics as Array<{ key: string }>).map((m) => m.key);
    expect(keys).toContain('entityOwnership');
    expect(keys).toContain('processCompliance');
    expect(keys).toContain('domainStructure');
    expect(keys).toContain('dpiasCoverage');
    expect(keys).toContain('processUnitCoverage');
    expect(keys).toContain('dataProcessorDocs');
    expect(keys).toContain('processPurpose');
  });
});
