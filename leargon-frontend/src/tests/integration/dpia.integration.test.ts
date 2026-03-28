import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createEntity,
  createProcess,
  ApiError,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { DpiaResponse } from '@/api/generated/model/dpiaResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('DPIA API', () => {
  let adminClient: AxiosInstance;
  let userClient: AxiosInstance;
  let otherClient: AxiosInstance;
  let adminToken: string;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    adminClient = createClient(baseUrl);
    userClient = createClient(baseUrl);
    otherClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'dpia-admin@example.com',
      username: 'dpiaadmin',
      password: 'password123',
      firstName: 'DPIA',
      lastName: 'Admin',
    });
    adminToken = adminAuth.accessToken;
    withToken(adminClient, adminToken);

    const userAuth = await signup(userClient, {
      email: 'dpia-user@example.com',
      username: 'dpiauser',
      password: 'password123',
      firstName: 'DPIA',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);

    const otherAuth = await signup(otherClient, {
      email: 'dpia-other@example.com',
      username: 'dpiaother',
      password: 'password123',
      firstName: 'DPIA',
      lastName: 'Other',
    });
    withToken(otherClient, otherAuth.accessToken);
  });

  // ─── Process DPIA ──────────────────────────────────────────────────────────

  it('can trigger a DPIA for a process', async () => {
    const process = await createProcess(userClient, 'DPIA Test Process');
    const res = await userClient.post<DpiaResponse>(`/processes/${process.key}/dpia`, null);

    expect(res.status).toBe(201);
    expect(res.data.status).toBe('IN_PROGRESS');
    expect(res.data.key).toMatch(/^dpia-/);
    expect(res.data.triggeredBy.username).toBe('dpiauser');
  });

  it('returns 409 when triggering duplicate DPIA for process', async () => {
    const process = await createProcess(userClient, 'Duplicate DPIA Process');
    await userClient.post(`/processes/${process.key}/dpia`, null);
    const res = await userClient.post(`/processes/${process.key}/dpia`, null);

    expect(res.status).toBe(409);
  });

  it('returns 404 when getting DPIA for process without one', async () => {
    const process = await createProcess(userClient, 'No DPIA Process');
    const res = await userClient.get(`/processes/${process.key}/dpia`);

    expect(res.status).toBe(404);
  });

  it('can get the DPIA for a process', async () => {
    const process = await createProcess(userClient, 'Get DPIA Process');
    await userClient.post(`/processes/${process.key}/dpia`, null);
    const res = await userClient.get<DpiaResponse>(`/processes/${process.key}/dpia`);

    expect(res.status).toBe(200);
    expect(res.data.status).toBe('IN_PROGRESS');
  });

  it('can update risk description', async () => {
    const process = await createProcess(userClient, 'Risk Desc Process');
    const dpiaRes = await userClient.post<DpiaResponse>(`/processes/${process.key}/dpia`, null);
    const dpiaKey = dpiaRes.data.key;

    const res = await userClient.put<DpiaResponse>(`/dpia/${dpiaKey}/risk-description`, {
      riskDescription: 'Sensitive PII is at risk',
    });

    expect(res.status).toBe(200);
    expect(res.data.riskDescription).toBe('Sensitive PII is at risk');
  });

  it('can update measures', async () => {
    const process = await createProcess(userClient, 'Measures Process');
    const dpiaRes = await userClient.post<DpiaResponse>(`/processes/${process.key}/dpia`, null);
    const dpiaKey = dpiaRes.data.key;

    const res = await userClient.put<DpiaResponse>(`/dpia/${dpiaKey}/measures`, {
      measures: 'Encrypt all personal data',
    });

    expect(res.status).toBe(200);
    expect(res.data.measures).toBe('Encrypt all personal data');
  });

  it('can update residual risk', async () => {
    const process = await createProcess(userClient, 'Residual Risk Process');
    const dpiaRes = await userClient.post<DpiaResponse>(`/processes/${process.key}/dpia`, null);
    const dpiaKey = dpiaRes.data.key;

    const res = await userClient.put<DpiaResponse>(`/dpia/${dpiaKey}/residual-risk`, {
      residualRisk: 'LOW',
      fdpicConsultationRequired: false,
    });

    expect(res.status).toBe(200);
    expect(res.data.residualRisk).toBe('LOW');
    expect(res.data.fdpicConsultationRequired).toBe(false);
  });

  it('can complete a DPIA', async () => {
    const process = await createProcess(userClient, 'Complete DPIA Process');
    const dpiaRes = await userClient.post<DpiaResponse>(`/processes/${process.key}/dpia`, null);
    const dpiaKey = dpiaRes.data.key;

    const res = await userClient.put<DpiaResponse>(`/dpia/${dpiaKey}/complete`, null);

    expect(res.status).toBe(200);
    expect(res.data.status).toBe('COMPLETED');
  });

  it('returns 403 when another user tries to update the DPIA', async () => {
    const process = await createProcess(userClient, 'Forbidden Update Process');
    const dpiaRes = await userClient.post<DpiaResponse>(`/processes/${process.key}/dpia`, null);
    const dpiaKey = dpiaRes.data.key;

    const res = await otherClient.put(`/dpia/${dpiaKey}/risk-description`, {
      riskDescription: 'Should not be allowed',
    });

    expect(res.status).toBe(403);
  });

  // ─── Entity DPIA ───────────────────────────────────────────────────────────

  it('can trigger a DPIA for a business entity', async () => {
    const entity = await createEntity(userClient, 'DPIA Test Entity');
    const res = await userClient.post<DpiaResponse>(`/business-entities/${entity.key}/dpia`, null);

    expect(res.status).toBe(201);
    expect(res.data.status).toBe('IN_PROGRESS');
    expect(res.data.triggeredBy.username).toBe('dpiauser');
  });

  it('returns 404 when getting DPIA for entity without one', async () => {
    const entity = await createEntity(userClient, 'No DPIA Entity');
    const res = await userClient.get(`/business-entities/${entity.key}/dpia`);

    expect(res.status).toBe(404);
  });

  // ─── Admin list ────────────────────────────────────────────────────────────

  it('admin can list all DPIAs', async () => {
    const process = await createProcess(userClient, 'Admin List DPIA Process');
    await userClient.post(`/processes/${process.key}/dpia`, null);

    const res = await adminClient.get<DpiaResponse[]>('/dpia');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(1);
  });

  it('non-admin can also list all DPIAs', async () => {
    const res = await userClient.get('/dpia');
    expect(res.status).toBe(200);
  });
});
