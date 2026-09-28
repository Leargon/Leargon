import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signupAdmin,
  signupCreator,
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

interface RegisterRow {
  key: string;
  name: string;
  parentKey?: string | null;
  hasChildren: boolean;
  personCategories: string;
  dataCategories: string;
  retentionPeriods: string;
}

/**
 * The processing register had no API-level coverage, which is how a 500 on this endpoint reached
 * production unnoticed (a NULL retention_period left by migration 061 read into a non-null Kotlin
 * property). These tests pin the contract: the endpoint answers, and it rolls up personal data.
 */
describe('Processing Register API', () => {
  let adminClient: AxiosInstance;
  let userClient: AxiosInstance;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    adminClient = createClient(baseUrl);
    userClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'preg-admin@example.com',
      username: 'pregadmin',
      password: 'password123',
      firstName: 'Register',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const userAuth = await signupCreator(userClient, {
      email: 'preg-user@example.com',
      username: 'preguser',
      password: 'password123',
      firstName: 'Register',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);
  });

  it('returns rows and splits data subjects from personal-data categories', async () => {
    const proc = await createProcess(userClient, 'PReg Recruitment');
    const subject = await createEntity(adminClient, 'PReg Candidate');
    const attribute = await createEntity(adminClient, 'PReg CV Document');
    await adminClient.put(`/business-entities/${subject.key}/personal-data`, {
      containsPersonalData: true,
      entityRole: 'DATA_SUBJECT',
    });
    await adminClient.put(`/business-entities/${attribute.key}/personal-data`, {
      containsPersonalData: true,
      entityRole: 'DATA_ATTRIBUTE',
    });
    await userClient.post(`/processes/${proc.key}/inputs`, { entityKey: subject.key });
    await userClient.post(`/processes/${proc.key}/inputs`, { entityKey: attribute.key });

    const res = await adminClient.get<RegisterRow[]>('/processing-register', { params: { locale: 'en' } });

    expect(res.status).toBe(200);
    const row = res.data.find((r) => r.key === proc.key);
    expect(row).toBeDefined();
    expect(row!.personCategories).toContain('PReg Candidate');
    expect(row!.dataCategories).toContain('PReg CV Document');
    expect(row!.personCategories).not.toContain('PReg CV Document');
  });

  it('rolls up a personal-data answer inherited from an interface entity', async () => {
    const proc = await createProcess(userClient, 'PReg Screening');
    const iface = await createEntity(adminClient, 'PReg Natural Person');
    await adminClient.put(`/business-entities/${iface.key}/personal-data`, {
      containsPersonalData: true,
      entityRole: 'DATA_SUBJECT',
    });

    // Only the concrete implementation is wired into the process, as a real model would be.
    const impl = await adminClient.post<{ key: string }>('/business-entities', {
      names: [{ locale: 'en', text: 'PReg Applicant Record' }],
      interfaces: [iface.key],
    });
    await userClient.post(`/processes/${proc.key}/inputs`, { entityKey: impl.data.key });

    const res = await adminClient.get<RegisterRow[]>('/processing-register', { params: { locale: 'en' } });

    const row = res.data.find((r) => r.key === proc.key);
    expect(row).toBeDefined();
    expect(row!.personCategories).toContain('PReg Applicant Record');
  });

  it('returns sub-processes as their own rows so the register can be drilled into', async () => {
    const parent = await createProcess(userClient, 'PReg Onboarding');
    const child = await createProcess(userClient, 'PReg Issue Badge', { parentProcessKey: parent.key });
    const badge = await createEntity(adminClient, 'PReg Badge Photo');
    await adminClient.put(`/business-entities/${badge.key}/personal-data`, {
      containsPersonalData: true,
      entityRole: 'DATA_ATTRIBUTE',
    });
    await userClient.post(`/processes/${child.key}/inputs`, { entityKey: badge.key });

    const res = await adminClient.get<RegisterRow[]>('/processing-register', { params: { locale: 'en' } });

    const parentRow = res.data.find((r) => r.key === parent.key);
    const childRow = res.data.find((r) => r.key === child.key);
    expect(parentRow).toBeDefined();
    expect(childRow).toBeDefined();
    expect(parentRow!.hasChildren).toBe(true);
    expect(parentRow!.parentKey ?? null).toBeNull();
    expect(childRow!.parentKey).toBe(parent.key);
    expect(childRow!.hasChildren).toBe(false);

    // The root keeps the Art. 30 roll-up; the drill-down row reports the same fact as its own.
    expect(parentRow!.dataCategories).toContain('PReg Badge Photo');
    expect(childRow!.dataCategories).toContain('PReg Badge Photo');
  });

  it('requires authentication', async () => {
    const unauthClient = createClient(getBackendUrl());
    const res = await unauthClient.get('/processing-register');
    expect(res.status).toBe(401);
  });
});
