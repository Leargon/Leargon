import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, signup, signupAdmin, withToken, createProcess, createEntity, createOrgUnit, createDomain } from './testClient';
import type { AxiosInstance } from 'axios';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Analytics API', () => {
  let userClient: AxiosInstance;
  let adminClient: AxiosInstance;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    userClient = createClient(baseUrl);
    adminClient = createClient(baseUrl);

    const userAuth = await signup(userClient, {
      email: 'analytics-user@example.com',
      username: 'analyticsuser',
      password: 'password123',
      firstName: 'Analytics',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'analytics-admin@example.com',
      username: 'analyticsadmin',
      password: 'password123',
      firstName: 'Analytics',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);
  });

  it('returns 401 without authentication', async () => {
    const client = createClient(getBackendUrl());
    const res = await client.get('/analytics/team-insights');
    expect(res.status).toBe(401);
  });

  it('returns 200 for authenticated user', async () => {
    const res = await userClient.get('/analytics/team-insights');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('conwaysLawAlignment');
  });

  it('userOwnershipWorkload includes user who owns entities and processes', async () => {
    await createEntity(userClient, 'Analytics Owned Entity');
    await createProcess(userClient, 'Analytics Owned Process');

    const res = await userClient.get('/analytics/team-insights');
    expect(res.status).toBe(200);

    const workload: Array<{ username: string; entityCount: number; processCount: number; totalCount: number }> =
      res.data.userOwnershipWorkload ?? [];
    const entry = workload.find((w) => w.username === 'analyticsuser');
    expect(entry).toBeDefined();
    expect(entry!.entityCount).toBeGreaterThanOrEqual(1);
    expect(entry!.processCount).toBeGreaterThanOrEqual(1);
    expect(entry!.totalCount).toBeGreaterThanOrEqual(2);
  });

  it('orgUnitProcessLoad includes org unit with assigned processes', async () => {
    const process = await createProcess(userClient, 'Analytics OrgUnit Process');
    const orgUnit = await createOrgUnit(adminClient, 'Analytics Finance Team');
    await userClient.put(`/processes/${process.key}/executing-units`, { keys: [orgUnit.key] });

    const res = await userClient.get('/analytics/team-insights');
    expect(res.status).toBe(200);

    const load: Array<{ orgUnitKey: string; orgUnitName: string; processCount: number }> =
      res.data.orgUnitProcessLoad ?? [];
    const entry = load.find((l) => l.orgUnitKey === orgUnit.key);
    expect(entry).toBeDefined();
    expect(entry!.orgUnitName).toBe('Analytics Finance Team');
    expect(entry!.processCount).toBeGreaterThanOrEqual(1);
  });

  it('bottleneckTeams contains org unit running processes in 3+ distinct domains', async () => {
    const domain1 = await createDomain(adminClient, 'Analytics Domain A');
    const domain2 = await createDomain(adminClient, 'Analytics Domain B');
    const domain3 = await createDomain(adminClient, 'Analytics Domain C');
    const orgUnit = await createOrgUnit(adminClient, 'Analytics Cross Team');
    const p1 = await createProcess(userClient, 'Analytics BN Process 1');
    const p2 = await createProcess(userClient, 'Analytics BN Process 2');
    const p3 = await createProcess(userClient, 'Analytics BN Process 3');

    await userClient.put(`/processes/${p1.key}/domain`, { businessDomainKey: domain1.key });
    await userClient.put(`/processes/${p2.key}/domain`, { businessDomainKey: domain2.key });
    await userClient.put(`/processes/${p3.key}/domain`, { businessDomainKey: domain3.key });
    await userClient.put(`/processes/${p1.key}/executing-units`, { keys: [orgUnit.key] });
    await userClient.put(`/processes/${p2.key}/executing-units`, { keys: [orgUnit.key] });
    await userClient.put(`/processes/${p3.key}/executing-units`, { keys: [orgUnit.key] });

    const res = await userClient.get('/analytics/team-insights');
    expect(res.status).toBe(200);

    const bottlenecks: Array<{ orgUnitKey: string; distinctDomainCount: number }> =
      res.data.bottleneckTeams ?? [];
    const entry = bottlenecks.find((b) => b.orgUnitKey === orgUnit.key);
    expect(entry).toBeDefined();
    expect(entry!.distinctDomainCount).toBeGreaterThanOrEqual(3);
  });
});
