import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, signup, signupCreator, signupAdmin, signupWithRoles, withToken, createProcess } from './testClient';
import type { AxiosInstance } from 'axios';
import type { MethodologyConfigEntry } from '@/api/generated/model/methodologyConfigEntry';
import type { ProcessResponse } from '@/api/generated/model/processResponse';

const ALL_METHODOLOGY_KEYS = ['DATA_GOVERNANCE', 'PROCESS_GOVERNANCE', 'GDPR', 'DDD', 'BCM', 'TEAM_TOPOLOGIES'];

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

/** All methodologies enabled, with PROCESS_GOVERNANCE verification on (so process edits flip to UNVERIFIED). */
function configWithProcessVerification(): MethodologyConfigEntry[] {
  return ALL_METHODOLOGY_KEYS.map((key) => ({
    key: key as MethodologyConfigEntry['key'],
    enabled: true,
    verificationEnabled: key === 'PROCESS_GOVERNANCE',
  }));
}

function statusOf(process: ProcessResponse, fieldName: string) {
  return process.fieldStatuses?.find((s) => s.fieldName === fieldName);
}

describe('Methodology-scoped roles (EDITOR / LEAD)', () => {
  let adminClient: AxiosInstance;
  let ownerClient: AxiosInstance;
  let editorClient: AxiosInstance;
  let leadClient: AxiosInstance;

  beforeAll(async () => {
    adminClient = createClient(getBackendUrl());
    ownerClient = createClient(getBackendUrl());
    editorClient = createClient(getBackendUrl());
    leadClient = createClient(getBackendUrl());

    const adminAuth = await signupAdmin(adminClient, {
      email: 'role-admin@example.com', username: 'roleadmin', password: 'password123', firstName: 'Role', lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const ownerAuth = await signupCreator(ownerClient, {
      email: 'role-owner@example.com', username: 'roleowner', password: 'password123', firstName: 'Role', lastName: 'Owner',
    });
    withToken(ownerClient, ownerAuth.accessToken);

    const editorAuth = await signupWithRoles(editorClient, {
      email: 'role-editor@example.com', username: 'roleeditor', password: 'password123', firstName: 'Role', lastName: 'Editor',
    }, ['ROLE_USER', 'ROLE_EDITOR_GDPR']);
    withToken(editorClient, editorAuth.accessToken);

    const leadAuth = await signupWithRoles(leadClient, {
      email: 'role-lead@example.com', username: 'rolelead', password: 'password123', firstName: 'Role', lastName: 'Lead',
    }, ['ROLE_USER', 'ROLE_LEAD_GDPR']);
    withToken(leadClient, leadAuth.accessToken);

    // Enable process verification so non-owner edits are observably UNVERIFIED.
    await adminClient.put('/administration/methodology-configurations', configWithProcessVerification());
  });

  afterAll(async () => {
    await adminClient.put('/administration/methodology-configurations',
      ALL_METHODOLOGY_KEYS.map((key) => ({ key, enabled: true })));
    await adminClient.put('/administration/field-configurations', []);
  });

  // ── EDITOR content edits ───────────────────────────────────────────────────

  it('EDITOR_GDPR can edit a GDPR process field; the change lands UNVERIFIED', async () => {
    const process = await createProcess(ownerClient, 'Editor GDPR Edit');
    const res = await editorClient.put<ProcessResponse>(`/processes/${process.key}/legal-basis`, { legalBasis: 'CONSENT' });
    expect(res.status).toBe(200);
    expect(res.data.legalBasis).toBe('CONSENT');
    expect(statusOf(res.data, 'legalBasis')?.status).toBe('UNVERIFIED');
    expect(statusOf(res.data, 'legalBasis')?.updatedByUsername).toBe('roleeditor');
  });

  it('EDITOR_GDPR cannot edit a non-GDPR process field (403)', async () => {
    const process = await createProcess(ownerClient, 'Editor Out Of Scope');
    const res = await editorClient.put(`/processes/${process.key}/type`, { processType: 'MANAGEMENT' });
    expect(res.status).toBe(403);
  });

  it('EDITOR_GDPR cannot verify a field (403)', async () => {
    const process = await createProcess(ownerClient, 'Editor Cannot Verify');
    const res = await editorClient.put(`/processes/${process.key}/field-verifications`,
      { fieldName: 'legalBasis', status: 'VERIFIED' });
    expect(res.status).toBe(403);
  });

  // ── LEAD content + config ──────────────────────────────────────────────────

  it('LEAD_GDPR can edit a GDPR field (UNVERIFIED) but cannot verify (403)', async () => {
    const process = await createProcess(ownerClient, 'Lead GDPR Edit');
    const edit = await leadClient.put<ProcessResponse>(`/processes/${process.key}/legal-basis`, { legalBasis: 'CONTRACT' });
    expect(edit.status).toBe(200);
    expect(statusOf(edit.data, 'legalBasis')?.status).toBe('UNVERIFIED');

    const verify = await leadClient.put(`/processes/${process.key}/field-verifications`,
      { fieldName: 'legalBasis', status: 'VERIFIED' });
    expect(verify.status).toBe(403);
  });

  it('LEAD_GDPR can change GDPR methodology config but not DDD (403)', async () => {
    const current = (await leadClient.get<MethodologyConfigEntry[]>('/administration/methodology-configurations')).data;

    const disableGdpr = current.map((e) => (e.key === 'GDPR' ? { ...e, enabled: false } : e));
    const ok = await leadClient.put<MethodologyConfigEntry[]>('/administration/methodology-configurations', disableGdpr);
    expect(ok.status).toBe(200);
    expect(ok.data.find((e) => e.key === 'GDPR')?.enabled).toBe(false);

    // restore GDPR, then attempt to change DDD (out of scope)
    await adminClient.put('/administration/methodology-configurations', configWithProcessVerification());
    const fresh = (await leadClient.get<MethodologyConfigEntry[]>('/administration/methodology-configurations')).data;
    const disableDdd = fresh.map((e) => (e.key === 'DDD' ? { ...e, enabled: false } : e));
    const denied = await leadClient.put('/administration/methodology-configurations', disableDdd);
    expect(denied.status).toBe(403);
  });

  it('EDITOR_GDPR (no lead scope) cannot change methodology config (403)', async () => {
    const current = (await editorClient.get<MethodologyConfigEntry[]>('/administration/methodology-configurations')).data;
    const disableGdpr = current.map((e) => (e.key === 'GDPR' ? { ...e, enabled: false } : e));
    const res = await editorClient.put('/administration/methodology-configurations', disableGdpr);
    expect(res.status).toBe(403);
  });

  // ── LEAD field configuration (scoped) ──────────────────────────────────────

  it('LEAD_GDPR can change a GDPR field configuration but not a DDD one (403)', async () => {
    const ok = await leadClient.put('/administration/field-configurations', [
      { entityType: 'BUSINESS_PROCESS', fieldName: 'legalBasis', visibility: 'HIDDEN', section: 'GDPR', maturityLevel: 'BASIC' },
    ]);
    expect(ok.status).toBe(200);

    const denied = await leadClient.put('/administration/field-configurations', [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'boundedContext', visibility: 'HIDDEN', section: 'DDD', maturityLevel: 'ADVANCED' },
    ]);
    expect(denied.status).toBe(403);

    // reset
    await adminClient.put('/administration/field-configurations', []);
  });

  it('EDITOR_GDPR (no lead scope) cannot change field configuration (403)', async () => {
    const res = await editorClient.put('/administration/field-configurations', [
      { entityType: 'BUSINESS_PROCESS', fieldName: 'legalBasis', visibility: 'HIDDEN', section: 'GDPR', maturityLevel: 'BASIC' },
    ]);
    expect(res.status).toBe(403);
  });

  // ── role assignment validation ─────────────────────────────────────────────

  it('admin assigning an unknown role token is rejected (400)', async () => {
    // create a throwaway user to target
    const target = createClient(getBackendUrl());
    await signup(target, {
      email: 'role-bad@example.com', username: 'rolebad', password: 'password123', firstName: 'Role', lastName: 'Bad',
    });
    const users = (await adminClient.get('/administration/users')).data as Array<{ id: number; email: string }>;
    const id = users.find((u) => u.email === 'role-bad@example.com')!.id;
    const res = await adminClient.put(`/administration/users/${id}`, { roles: ['ROLE_LEAD_NONSENSE'] });
    expect(res.status).toBe(400);
  });

  // ── assignable users (non-admin picker source) ─────────────────────────────

  it('a non-admin can read the assignable-users list (owner/steward picker source)', async () => {
    const res = await editorClient.get<Array<{ username: string; firstName: string; lastName: string }>>(
      '/administration/users/assignable',
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.some((u) => u.username === 'roleowner')).toBe(true);
    expect(res.data.some((u) => u.username === 'roleadmin')).toBe(true);
  });

  it('assignable-users exposes only minimal fields (no roles or email)', async () => {
    const res = await leadClient.get<Array<Record<string, unknown>>>('/administration/users/assignable');
    expect(res.status).toBe(200);
    const entry = res.data.find((u) => u.username === 'roleadmin');
    expect(entry).toBeDefined();
    expect(entry).toHaveProperty('firstName');
    expect(entry).not.toHaveProperty('roles');
    expect(entry).not.toHaveProperty('email');
  });

  it('the full user list stays admin-only (non-admin gets 403)', async () => {
    const res = await editorClient.get('/administration/users');
    expect(res.status).toBe(403);
  });
});
