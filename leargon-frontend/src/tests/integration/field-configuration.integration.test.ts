import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, signup, signupAdmin, withToken, createEntity, ApiError } from './testClient';
import type { AxiosInstance } from 'axios';
import type { FieldConfigurationEntry } from '@/api/generated/model/fieldConfigurationEntry';
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
});
