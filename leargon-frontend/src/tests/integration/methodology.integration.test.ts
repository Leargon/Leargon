import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, signup, signupAdmin, withToken, createEntity } from './testClient';
import type { AxiosInstance } from 'axios';
import type { MethodologyConfigEntry } from '@/api/generated/model/methodologyConfigEntry';
import type { FieldConfigurationDefinition } from '@/api/generated/model/fieldConfigurationDefinition';
import type { BusinessEntityResponse } from '@/api/generated/model/businessEntityResponse';
import type { FieldConfigurationEntry } from '@/api/generated/model/fieldConfigurationEntry';

const ALL_METHODOLOGY_KEYS = ['DATA_GOVERNANCE', 'PROCESS_GOVERNANCE', 'GDPR', 'DDD', 'BCM', 'TEAM_TOPOLOGIES'];

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

function allEnabled(): MethodologyConfigEntry[] {
  return ALL_METHODOLOGY_KEYS.map((key) => ({
    key: key as MethodologyConfigEntry['key'],
    enabled: true,
  }));
}

describe('Methodology Configuration', () => {
  let adminClient: AxiosInstance;
  let userClient: AxiosInstance;

  beforeAll(async () => {
    adminClient = createClient(getBackendUrl());
    userClient = createClient(getBackendUrl());

    const adminAuth = await signupAdmin(adminClient, {
      email: 'meth-admin@example.com',
      username: 'methadmin',
      password: 'password123',
      firstName: 'Meth',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const userAuth = await signup(userClient, {
      email: 'meth-user@example.com',
      username: 'methuser',
      password: 'password123',
      firstName: 'Meth',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);
  });

  afterAll(async () => {
    await adminClient.put('/administration/methodology-configurations', allEnabled());
    await adminClient.put('/administration/field-configurations', []);
  });

  // ── GET defaults ─────────────────────────────────────────────────────────

  it('GET /administration/methodology-configurations returns all 6 methodologies enabled by default', async () => {
    const res = await adminClient.get<MethodologyConfigEntry[]>('/administration/methodology-configurations');
    expect(res.status).toBe(200);
    expect(res.data.length).toBe(6);
    for (const entry of res.data) {
      expect(ALL_METHODOLOGY_KEYS).toContain(entry.key);
      expect(entry.enabled).toBe(true);
    }
  });

  it('GET /administration/methodology-configurations returns 200 for non-admin', async () => {
    const res = await userClient.get<MethodologyConfigEntry[]>('/administration/methodology-configurations');
    expect(res.status).toBe(200);
    expect(res.data.length).toBe(6);
  });

  it('GET /administration/methodology-configurations returns 401 for unauthenticated', async () => {
    const anonClient = createClient(getBackendUrl());
    const res = await anonClient.get('/administration/methodology-configurations');
    expect(res.status).toBe(401);
  });

  // ── PUT (replace) ─────────────────────────────────────────────────────────

  it('PUT disabling GDPR → GET confirms GDPR disabled, all others enabled', async () => {
    const payload = ALL_METHODOLOGY_KEYS.map((key) => ({
      key: key as MethodologyConfigEntry['key'],
      enabled: key !== 'GDPR',
    }));
    const put = await adminClient.put<MethodologyConfigEntry[]>('/administration/methodology-configurations', payload);
    expect(put.status).toBe(200);

    const get = await adminClient.get<MethodologyConfigEntry[]>('/administration/methodology-configurations');
    expect(get.status).toBe(200);
    const gdpr = get.data.find((e) => e.key === 'GDPR');
    expect(gdpr?.enabled).toBe(false);
    const rest = get.data.filter((e) => e.key !== 'GDPR');
    expect(rest.every((e) => e.enabled)).toBe(true);

    await adminClient.put('/administration/methodology-configurations', allEnabled());
  });

  it('PUT returns 403 for non-admin', async () => {
    const res = await userClient.put('/administration/methodology-configurations', allEnabled());
    expect(res.status).toBe(403);
  });

  // ── Disabled methodology → field-configurations/definitions ──────────────

  it('disabling DDD excludes DDD section fields from definitions', async () => {
    const payload = ALL_METHODOLOGY_KEYS.map((key) => ({
      key: key as MethodologyConfigEntry['key'],
      enabled: key !== 'DDD',
    }));
    await adminClient.put('/administration/methodology-configurations', payload);

    const res = await adminClient.get<FieldConfigurationDefinition[]>(
      '/administration/field-configurations/definitions',
    );
    expect(res.status).toBe(200);

    const dddFields = res.data.filter((d) => d.section === 'DDD' || d.section === 'STRATEGIC');
    expect(dddFields.length).toBe(0);

    const coreFields = res.data.filter((d) => d.entityType === 'BUSINESS_ENTITY' && d.section === 'CORE');
    expect(coreFields.length).toBeGreaterThan(0);

    await adminClient.put('/administration/methodology-configurations', allEnabled());
  });

  it('disabling GDPR excludes GDPR section fields from definitions', async () => {
    const payload = ALL_METHODOLOGY_KEYS.map((key) => ({
      key: key as MethodologyConfigEntry['key'],
      enabled: key !== 'GDPR',
    }));
    await adminClient.put('/administration/methodology-configurations', payload);

    const res = await adminClient.get<FieldConfigurationDefinition[]>(
      '/administration/field-configurations/definitions',
    );
    expect(res.status).toBe(200);
    const gdprFields = res.data.filter((d) => d.section === 'GDPR');
    expect(gdprFields.length).toBe(0);

    await adminClient.put('/administration/methodology-configurations', allEnabled());
  });

  it('re-enabling DDD restores DDD fields in definitions', async () => {
    await adminClient.put(
      '/administration/methodology-configurations',
      ALL_METHODOLOGY_KEYS.map((k) => ({ key: k as MethodologyConfigEntry['key'], enabled: k !== 'DDD' })),
    );
    await adminClient.put('/administration/methodology-configurations', allEnabled());

    const res = await adminClient.get<FieldConfigurationDefinition[]>(
      '/administration/field-configurations/definitions',
    );
    expect(res.status).toBe(200);
    const dddFields = res.data.filter((d) => d.section === 'DDD');
    expect(dddFields.length).toBeGreaterThan(0);
  });

  // ── Disabled methodology → entity response (missingMandatoryFields) ───────

  it('disabling DATA_GOVERNANCE suppresses DATA_GOVERNANCE fields from entity missingMandatoryFields', async () => {
    // Make retentionPeriod mandatory
    const fc: FieldConfigurationEntry[] = [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod', visibility: 'SHOWN', section: 'DATA_GOVERNANCE', maturityLevel: 'BASIC' },
    ];
    await adminClient.put('/administration/field-configurations', fc);

    // Disable DATA_GOVERNANCE
    await adminClient.put(
      '/administration/methodology-configurations',
      ALL_METHODOLOGY_KEYS.map((k) => ({ key: k as MethodologyConfigEntry['key'], enabled: k !== 'DATA_GOVERNANCE' })),
    );

    const entity = await createEntity(adminClient, 'Meth DG Suppressed Entity');
    const res = await adminClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);
    expect(res.status).toBe(200);
    // retentionPeriod is in DATA_GOVERNANCE section — should not appear in missingMandatoryFields
    expect(
      res.data.missingMandatoryFields == null ||
      !res.data.missingMandatoryFields.includes('retentionPeriod'),
    ).toBe(true);

    await adminClient.put('/administration/methodology-configurations', allEnabled());
    await adminClient.put('/administration/field-configurations', []);
  });

  // ── Per-area verification toggle ──────────────────────────────────────────

  it('verification is OFF by default; enabling DATA_GOVERNANCE surfaces entity fieldStatuses, disabling hides them', async () => {
    // Default off — a fresh entity carries no field statuses.
    await adminClient.put('/administration/methodology-configurations', allEnabled());
    const entity = await createEntity(adminClient, 'Meth Verif Entity');
    const off = await adminClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);
    expect((off.data.fieldStatuses ?? []).length).toBe(0);

    // Enable verification for Data Governance only.
    await adminClient.put(
      '/administration/methodology-configurations',
      ALL_METHODOLOGY_KEYS.map((k) => ({
        key: k as MethodologyConfigEntry['key'],
        enabled: true,
        verificationEnabled: k === 'DATA_GOVERNANCE',
      })),
    );
    const cfg = await adminClient.get<MethodologyConfigEntry[]>('/administration/methodology-configurations');
    expect(cfg.data.find((e) => e.key === 'DATA_GOVERNANCE')?.verificationEnabled).toBe(true);

    const on = await adminClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);
    expect((on.data.fieldStatuses ?? []).length).toBeGreaterThan(0);

    // Disable again → statuses suppressed.
    await adminClient.put('/administration/methodology-configurations', allEnabled());
    const offAgain = await adminClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);
    expect((offAgain.data.fieldStatuses ?? []).length).toBe(0);
  });

  it('setting a field verification returns 403 while the area is disabled (the default)', async () => {
    await adminClient.put('/administration/methodology-configurations', allEnabled());
    const entity = await createEntity(adminClient, 'Meth Verif 403 Entity');

    const res = await adminClient.put(`/business-entities/${entity.key}/field-verifications`, {
      fieldName: 'names.en',
      status: 'VERIFIED',
    });
    expect(res.status).toBe(403);
  });

  it('with DATA_GOVERNANCE enabled, retentionPeriod appears in missingMandatoryFields when absent', async () => {
    await adminClient.put('/administration/field-configurations', [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod', visibility: 'SHOWN', section: 'DATA_GOVERNANCE', maturityLevel: 'BASIC' },
    ]);
    await adminClient.put('/administration/methodology-configurations', allEnabled());

    const entity = await createEntity(adminClient, 'Meth DG Active Entity');
    const res = await adminClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);
    expect(res.status).toBe(200);
    expect(res.data.missingMandatoryFields).toContain('retentionPeriod');

    await adminClient.put('/administration/field-configurations', []);
  });
});
