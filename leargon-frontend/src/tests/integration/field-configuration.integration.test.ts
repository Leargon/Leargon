import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, signup, signupAdmin, withToken, createEntity, ApiError } from './testClient';
import type { AxiosInstance } from 'axios';
import type { FieldConfigurationEntry } from '@/api/generated/model/fieldConfigurationEntry';
import type { FieldConfigurationDefinition } from '@/api/generated/model/fieldConfigurationDefinition';
import type { BusinessEntityResponse } from '@/api/generated/model/businessEntityResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Field Configuration E2E', () => {
  let adminClient: AxiosInstance;
  let userClient: AxiosInstance;
  let adminToken: string;

  beforeAll(async () => {
    adminClient = createClient(getBackendUrl());
    userClient = createClient(getBackendUrl());

    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-fc-admin@example.com',
      username: 'fefcadmin',
      password: 'password123',
      firstName: 'FC',
      lastName: 'Admin',
    });
    adminToken = adminAuth.accessToken;
    withToken(adminClient, adminToken);

    const userAuth = await signup(userClient, {
      email: 'fe-fc-user@example.com',
      username: 'fefcuser',
      password: 'password123',
      firstName: 'FC',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);
  });

  afterAll(async () => {
    // Clean up — replace with empty configuration
    await adminClient.put<FieldConfigurationEntry[]>('/administration/field-configurations', []);
  });

  // =====================
  // GET
  // =====================

  it('GET /administration/field-configurations returns a list (admin)', async () => {
    const res = await adminClient.get<FieldConfigurationEntry[]>('/administration/field-configurations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('GET /administration/field-configurations returns 403 for non-admin', async () => {
    const res = await userClient.get('/administration/field-configurations');
    expect(res.status).toBe(403);
  });

  // =====================
  // PUT (replace)
  // =====================

  it('PUT /administration/field-configurations replaces all configurations', async () => {
    const entries: FieldConfigurationEntry[] = [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod' },
      { entityType: 'BUSINESS_ENTITY', fieldName: 'businessDomain' },
      { entityType: 'BUSINESS_DOMAIN', fieldName: 'type' },
    ];
    const res = await adminClient.put<FieldConfigurationEntry[]>('/administration/field-configurations', entries);
    expect(res.status).toBe(200);
    expect(res.data.length).toBe(3);
    expect(res.data.some((e: FieldConfigurationEntry) => e.entityType === 'BUSINESS_ENTITY' && e.fieldName === 'retentionPeriod')).toBe(true);
    expect(res.data.some((e: FieldConfigurationEntry) => e.entityType === 'BUSINESS_ENTITY' && e.fieldName === 'businessDomain')).toBe(true);
    expect(res.data.some((e: FieldConfigurationEntry) => e.entityType === 'BUSINESS_DOMAIN' && e.fieldName === 'type')).toBe(true);
  });

  it('PUT /administration/field-configurations replaces (not appends) existing configurations', async () => {
    await adminClient.put('/administration/field-configurations', [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod' },
    ]);

    const res = await adminClient.put<FieldConfigurationEntry[]>('/administration/field-configurations', [
      { entityType: 'BUSINESS_DOMAIN', fieldName: 'type' },
    ]);
    expect(res.status).toBe(200);
    expect(res.data.length).toBe(1);
    expect(res.data[0].entityType).toBe('BUSINESS_DOMAIN');
    expect(res.data[0].fieldName).toBe('type');
  });

  it('PUT /administration/field-configurations returns 403 for non-admin', async () => {
    const res = await userClient.put('/administration/field-configurations', [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod' },
    ]);
    expect(res.status).toBe(403);
  });

  // =====================
  // missingMandatoryFields integration
  // =====================

  it('entity shows missingMandatoryFields when mandatory fields are configured but absent', async () => {
    // Configure retentionPeriod as mandatory
    await adminClient.put('/administration/field-configurations', [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod' },
    ]);

    // Create an entity without retentionPeriod
    const entity = await createEntity(adminClient, 'FC Missing Fields Entity');

    const res = await adminClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);
    expect(res.status).toBe(200);
    expect(res.data.missingMandatoryFields).toBeTruthy();
    expect(res.data.missingMandatoryFields).toContain('retentionPeriod');
  });

  it('entity shows null missingMandatoryFields when no fields are configured', async () => {
    // Clear configuration
    await adminClient.put('/administration/field-configurations', []);

    const entity = await createEntity(adminClient, 'FC No Config Entity');

    const res = await adminClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);
    expect(res.status).toBe(200);
    expect(res.data.missingMandatoryFields == null).toBe(true);
  });

  it('entity shows null missingMandatoryFields when all mandatory fields are present', async () => {
    // Configure retentionPeriod as mandatory
    await adminClient.put('/administration/field-configurations', [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod' },
    ]);

    // Create entity then set retentionPeriod
    const entity = await createEntity(adminClient, 'FC Complete Entity');
    const updateRes = await adminClient.put<BusinessEntityResponse>(
      `/business-entities/${entity.key}/retention-period`,
      { retentionPeriod: '7 years' },
    );
    expect(updateRes.status).toBe(200);

    const res = await adminClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);
    expect(res.status).toBe(200);
    expect(res.data.missingMandatoryFields == null || res.data.missingMandatoryFields.length === 0).toBe(true);
  });

  // =====================
  // mandatoryFields property
  // =====================

  it('entity response includes mandatoryFields list when fields are configured', async () => {
    await adminClient.put('/administration/field-configurations', [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod' },
      { entityType: 'BUSINESS_ENTITY', fieldName: 'businessDomain' },
    ]);

    const entity = await createEntity(adminClient, 'FC MandatoryFields Entity');
    const res = await adminClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.mandatoryFields)).toBe(true);
    expect(res.data.mandatoryFields).toContain('retentionPeriod');
    expect(res.data.mandatoryFields).toContain('businessDomain');
  });

  it('entity response has null mandatoryFields when no fields are configured', async () => {
    await adminClient.put('/administration/field-configurations', []);

    const entity = await createEntity(adminClient, 'FC No MandatoryFields Entity');
    const res = await adminClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);

    expect(res.status).toBe(200);
    expect(res.data.mandatoryFields == null).toBe(true);
  });

  it('entity correctly detects locale-specific name field as present', async () => {
    await adminClient.put('/administration/field-configurations', [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'names.en' },
    ]);

    const entity = await createEntity(adminClient, 'FC Locale Name Entity');
    const res = await adminClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);

    expect(res.status).toBe(200);
    // Entity has an English name, so it should not be missing
    expect(res.data.missingMandatoryFields == null || !res.data.missingMandatoryFields.includes('names.en')).toBe(true);
    expect(res.data.mandatoryFields).toContain('names.en');
  });

  // =====================
  // visibility / section / maturityLevel (new fields)
  // =====================

  it('PUT /administration/field-configurations persists visibility, section and maturityLevel', async () => {
    const entries: FieldConfigurationEntry[] = [
      {
        entityType: 'BUSINESS_ENTITY',
        fieldName: 'retentionPeriod',
        visibility: 'SHOWN',
        section: 'DATA_GOVERNANCE',
        maturityLevel: 'BASIC',
      },
      {
        entityType: 'BUSINESS_ENTITY',
        fieldName: 'qualityRules',
        visibility: 'HIDDEN',
        section: 'DATA_QUALITY',
        maturityLevel: 'ADVANCED',
      },
    ];

    const res = await adminClient.put<FieldConfigurationEntry[]>('/administration/field-configurations', entries);
    expect(res.status).toBe(200);

    const retention = res.data.find((e) => e.fieldName === 'retentionPeriod');
    expect(retention?.visibility).toBe('SHOWN');
    expect(retention?.section).toBe('DATA_GOVERNANCE');
    expect(retention?.maturityLevel).toBe('BASIC');

    const quality = res.data.find((e) => e.fieldName === 'qualityRules');
    expect(quality?.visibility).toBe('HIDDEN');
    expect(quality?.section).toBe('DATA_QUALITY');
    expect(quality?.maturityLevel).toBe('ADVANCED');
  });

  it('PUT /administration/field-configurations applies defaults when new fields are omitted', async () => {
    const res = await adminClient.put<FieldConfigurationEntry[]>('/administration/field-configurations', [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'retentionPeriod' },
    ]);
    expect(res.status).toBe(200);

    const entry = res.data[0];
    expect(entry.visibility).toBe('SHOWN');
    expect(entry.section).toBe('CORE');
    expect(entry.maturityLevel).toBe('BASIC');
  });

  // =====================
  // GET /definitions
  // =====================

  it('GET /administration/field-configurations/definitions returns definitions for all entity types', async () => {
    const res = await adminClient.get<FieldConfigurationDefinition[]>(
      '/administration/field-configurations/definitions',
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);

    const entityTypes = new Set(res.data.map((d) => d.entityType));
    expect(entityTypes.has('BUSINESS_ENTITY')).toBe(true);
    expect(entityTypes.has('BUSINESS_DOMAIN')).toBe(true);
    expect(entityTypes.has('BUSINESS_PROCESS')).toBe(true);
    expect(entityTypes.has('ORGANISATIONAL_UNIT')).toBe(true);
  });

  it('GET /administration/field-configurations/definitions: each definition has required fields', async () => {
    const res = await adminClient.get<FieldConfigurationDefinition[]>(
      '/administration/field-configurations/definitions',
    );
    expect(res.status).toBe(200);
    for (const def of res.data) {
      expect(def.entityType).toBeTruthy();
      expect(def.fieldName).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(def.section).toBeTruthy();
      expect(def.maturityLevel).toBeTruthy();
      expect(typeof def.mandatoryCapable).toBe('boolean');
    }
  });

  it('GET /administration/field-configurations/definitions: locale fields are expanded (no {locale} placeholders)', async () => {
    const res = await adminClient.get<FieldConfigurationDefinition[]>(
      '/administration/field-configurations/definitions',
    );
    expect(res.status).toBe(200);

    // No raw placeholder should appear
    expect(res.data.every((d) => !d.fieldName.includes('{locale}'))).toBe(true);
    expect(res.data.every((d) => !d.fieldName.includes('{classKey}'))).toBe(true);

    // The English locale should be expanded for BUSINESS_ENTITY names
    expect(res.data.some((d) => d.entityType === 'BUSINESS_ENTITY' && d.fieldName === 'names.en')).toBe(true);
  });

  it('GET /administration/field-configurations/definitions: locale group entry has localeGroup=true and mandatoryCapable=false', async () => {
    const res = await adminClient.get<FieldConfigurationDefinition[]>(
      '/administration/field-configurations/definitions',
    );
    expect(res.status).toBe(200);

    // The "names" group entry for BUSINESS_ENTITY should have localeGroup=true
    const namesGroup = res.data.find((d) => d.entityType === 'BUSINESS_ENTITY' && d.fieldName === 'names');
    expect(namesGroup).toBeDefined();
    expect(namesGroup?.localeGroup).toBe(true);
    expect(namesGroup?.mandatoryCapable).toBe(false);

    // Per-locale entry should have localeGroup=false and mandatoryCapable=true
    const namesEn = res.data.find((d) => d.entityType === 'BUSINESS_ENTITY' && d.fieldName === 'names.en');
    expect(namesEn).toBeDefined();
    expect(namesEn?.localeGroup).toBe(false);
    expect(namesEn?.mandatoryCapable).toBe(true);
  });

  it('GET /administration/field-configurations/definitions: mandatoryCapable is false for non-capable fields', async () => {
    const res = await adminClient.get<FieldConfigurationDefinition[]>(
      '/administration/field-configurations/definitions',
    );
    expect(res.status).toBe(200);

    const parent = res.data.find((d) => d.entityType === 'BUSINESS_ENTITY' && d.fieldName === 'parent');
    expect(parent).toBeDefined();
    expect(parent?.mandatoryCapable).toBe(false);

    const retention = res.data.find((d) => d.entityType === 'BUSINESS_ENTITY' && d.fieldName === 'retentionPeriod');
    expect(retention).toBeDefined();
    expect(retention?.mandatoryCapable).toBe(true);
  });

  it('hiding locale group "names" expands hiddenFields to per-locale entries in entity response', async () => {
    await adminClient.put('/administration/field-configurations', [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'names', visibility: 'HIDDEN', section: 'CORE', maturityLevel: 'BASIC' },
    ]);

    const entity = await createEntity(adminClient, 'FC Locale Group Hidden Entity');
    const res = await adminClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);

    expect(res.status).toBe(200);
    expect(res.data.hiddenFields).toContain('names.en');
    expect(res.data.hiddenFields).not.toContain('names'); // expanded, not kept as group
  });

  it('locale group HIDDEN + per-locale mandatory in payload — backend drops per-locale entry', async () => {
    const res = await adminClient.put<FieldConfigurationEntry[]>('/administration/field-configurations', [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'names', visibility: 'HIDDEN', section: 'CORE', maturityLevel: 'BASIC' },
      { entityType: 'BUSINESS_ENTITY', fieldName: 'names.en', visibility: 'SHOWN', section: 'CORE', maturityLevel: 'BASIC' },
    ]);
    expect(res.status).toBe(200);
    // Only the group HIDDEN entry should be persisted
    expect(res.data.length).toBe(1);
    expect(res.data[0].fieldName).toBe('names');
    expect(res.data[0].visibility).toBe('HIDDEN');
  });

  it('GET /administration/field-configurations/definitions returns 403 for non-admin', async () => {
    const res = await userClient.get('/administration/field-configurations/definitions');
    expect(res.status).toBe(403);
  });
});
