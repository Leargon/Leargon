import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createClassification,
  createEntity,
  createDomain,
  createProcess,
  createOrgUnit,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { ClassificationResponse } from '@/api/generated/model/classificationResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Classification E2E', () => {
  let adminClient: AxiosInstance;
  let adminToken: string;

  beforeAll(async () => {
    adminClient = createClient(getBackendUrl());

    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-cls-admin@example.com',
      username: 'feclsadmin',
      password: 'password123',
      firstName: 'Class',
      lastName: 'Admin',
    });
    adminToken = adminAuth.accessToken;
    withToken(adminClient, adminToken);
  });

  // =====================
  // CREATE
  // =====================

  it('should create classification with values (BUSINESS_ENTITY)', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Data Sensitivity',
      'BUSINESS_ENTITY',
      [
        { key: 'public', names: [{ locale: 'en', text: 'Public' }] },
        { key: 'internal', names: [{ locale: 'en', text: 'Internal' }] },
        { key: 'confidential', names: [{ locale: 'en', text: 'Confidential' }] },
      ],
    );
    expect(classif.key).toBeTruthy();
    expect(classif.values.length).toBe(3);
    expect(classif.assignableTo).toBe('BUSINESS_ENTITY');
  });

  it('should create classification (BUSINESS_DOMAIN)', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Domain Classification',
      'BUSINESS_DOMAIN',
      [{ key: 'val1', names: [{ locale: 'en', text: 'Value 1' }] }],
    );
    expect(classif.assignableTo).toBe('BUSINESS_DOMAIN');
  });

  it('should create classification (BUSINESS_PROCESS)', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Process Classification',
      'BUSINESS_PROCESS',
      [{ key: 'val1', names: [{ locale: 'en', text: 'Value 1' }] }],
    );
    expect(classif.assignableTo).toBe('BUSINESS_PROCESS');
  });

  it('should reject classification creation by non-admin', async () => {
    const userClient = createClient(getBackendUrl());
    const userAuth = await signup(userClient, {
      email: 'fe-cls-nonadmin@example.com',
      username: 'feclsnonadmin',
      password: 'password123',
      firstName: 'Regular',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);

    const res = await userClient.post('/classifications', {
      names: [{ locale: 'en', text: 'Unauthorized' }],
      assignableTo: 'BUSINESS_ENTITY',
      values: [],
    });
    expect(res.status).toBe(403);
  });

  // =====================
  // READ
  // =====================

  it('should list all classifications', async () => {
    await createClassification(adminClient, 'FE List Class A', 'BUSINESS_ENTITY');
    await createClassification(adminClient, 'FE List Class B', 'BUSINESS_ENTITY');

    const res = await adminClient.get<ClassificationResponse[]>('/classifications');
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should get classification by key', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Gettable Class',
      'BUSINESS_ENTITY',
      [{ key: 'v1', names: [{ locale: 'en', text: 'V1' }] }],
    );

    const res = await adminClient.get<ClassificationResponse>(
      `/classifications/${classif.key}`,
    );
    expect(res.status).toBe(200);
    expect(res.data.key).toBe(classif.key);
    expect(res.data.values.length).toBe(1);
  });

  it('should filter classifications by assignable-to', async () => {
    await createClassification(adminClient, 'FE Filter Entity', 'BUSINESS_ENTITY');
    await createClassification(adminClient, 'FE Filter Domain', 'BUSINESS_DOMAIN');

    const res = await adminClient.get<ClassificationResponse[]>(
      '/classifications?assignable-to=BUSINESS_ENTITY',
    );
    expect(res.status).toBe(200);
    expect(
      res.data.every((c) => c.assignableTo === 'BUSINESS_ENTITY'),
    ).toBe(true);
  });

  // =====================
  // UPDATE VALUES
  // =====================

  it('should add a value to existing classification', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Addable Class',
      'BUSINESS_ENTITY',
      [{ key: 'existing', names: [{ locale: 'en', text: 'Existing' }] }],
    );

    const res = await adminClient.post(`/classifications/${classif.key}/values`, {
      key: 'newval',
      names: [{ locale: 'en', text: 'New Value' }],
    });
    expect(res.status).toBe(201);
  });

  it('should update a classification value', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Val Update Class',
      'BUSINESS_ENTITY',
      [{ key: 'updval', names: [{ locale: 'en', text: 'Original Value' }] }],
    );

    const res = await adminClient.put(
      `/classifications/${classif.key}/values/updval`,
      {
        names: [
          { locale: 'en', text: 'Updated Value' },
          { locale: 'de', text: 'Aktualisierter Wert' },
        ],
      },
    );
    expect(res.status).toBe(200);
  });

  it('should delete a classification value', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Val Delete Class',
      'BUSINESS_ENTITY',
      [
        { key: 'keep', names: [{ locale: 'en', text: 'Keep' }] },
        { key: 'remove', names: [{ locale: 'en', text: 'Remove' }] },
      ],
    );

    const delRes = await adminClient.delete(
      `/classifications/${classif.key}/values/remove`,
    );
    expect(delRes.status).toBe(204);

    // Verify value is removed
    const getRes = await adminClient.get<ClassificationResponse>(
      `/classifications/${classif.key}`,
    );
    expect(getRes.data.values.length).toBe(1);
    expect(getRes.data.values[0].key).toBe('keep');
  });

  // =====================
  // ASSIGN TO ENTITY, DOMAIN, PROCESS
  // =====================

  it('should assign classification to entity', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Assign Entity Class',
      'BUSINESS_ENTITY',
      [{ key: 'yes', names: [{ locale: 'en', text: 'Yes' }] }],
    );
    const entity = await createEntity(adminClient, 'FE Assignable Entity');

    const res = await adminClient.put(
      `/business-entities/${entity.key}/classifications`,
      [{ classificationKey: classif.key, valueKey: 'yes' }],
    );
    expect(res.status).toBe(200);
    expect(res.data.classificationAssignments.length).toBe(1);
  });

  it('should assign classification to domain', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Assign Domain Class',
      'BUSINESS_DOMAIN',
      [{ key: 'no', names: [{ locale: 'en', text: 'No' }] }],
    );
    const domain = await createDomain(adminClient, 'FE Assignable Domain');

    const res = await adminClient.put(
      `/business-domains/${domain.key}/classifications`,
      [{ classificationKey: classif.key, valueKey: 'no' }],
    );
    expect(res.status).toBe(200);
    expect(res.data.classificationAssignments.length).toBe(1);
  });

  it('should assign classification to process', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Assign Process Class',
      'BUSINESS_PROCESS',
      [{ key: 'high', names: [{ locale: 'en', text: 'High' }] }],
    );
    const proc = await createProcess(adminClient, 'FE Assignable Process');

    const res = await adminClient.put(
      `/processes/${proc.key}/classifications`,
      [{ classificationKey: classif.key, valueKey: 'high' }],
    );
    expect(res.status).toBe(200);
    expect(res.data.classificationAssignments.length).toBe(1);
  });

  it('should create classification (ORGANISATIONAL_UNIT)', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Org Unit Classification',
      'ORGANISATIONAL_UNIT',
      [{ key: 'val1', names: [{ locale: 'en', text: 'Value 1' }] }],
    );
    expect(classif.assignableTo).toBe('ORGANISATIONAL_UNIT');
  });

  it('should assign classification to organisational unit', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Assign Org Unit Class',
      'ORGANISATIONAL_UNIT',
      [{ key: 'low', names: [{ locale: 'en', text: 'Low' }] }],
    );
    const unit = await createOrgUnit(adminClient, 'FE Assignable Org Unit');

    const res = await adminClient.put(
      `/organisational-units/${unit.key}/classifications`,
      [{ classificationKey: classif.key, valueKey: 'low' }],
    );
    expect(res.status).toBe(200);
    expect(res.data.classificationAssignments.length).toBe(1);
    expect(res.data.classificationAssignments[0].classificationKey).toBe(classif.key);
    expect(res.data.classificationAssignments[0].valueKey).toBe('low');
  });

  it('should reject assigning entity classification to organisational unit', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Entity-Only Class For Org',
      'BUSINESS_ENTITY',
      [{ key: 'v1', names: [{ locale: 'en', text: 'V1' }] }],
    );
    const unit = await createOrgUnit(adminClient, 'FE Wrong Type Org Unit');

    const res = await adminClient.put(
      `/organisational-units/${unit.key}/classifications`,
      [{ classificationKey: classif.key, valueKey: 'v1' }],
    );
    expect(res.status).toBe(400);
  });

  // =====================
  // DELETE CLASSIFICATION
  // =====================

  it('should delete classification', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Deletable Class',
      'BUSINESS_ENTITY',
    );

    const delRes = await adminClient.delete(`/classifications/${classif.key}`);
    expect(delRes.status).toBe(204);

    // Verify it's gone
    const getRes = await adminClient.get(`/classifications/${classif.key}`);
    expect(getRes.status).toBe(404);
  });

  it('should reject classification delete by non-admin', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Protected Class',
      'BUSINESS_ENTITY',
    );

    const userClient = createClient(getBackendUrl());
    const userAuth = await signup(userClient, {
      email: 'fe-cls-deluser@example.com',
      username: 'feclsdeluser',
      password: 'password123',
      firstName: 'Regular',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);

    const res = await userClient.delete(`/classifications/${classif.key}`);
    expect(res.status).toBe(403);
  });

  // =====================
  // MULTI-VALUE CARDINALITY
  // =====================

  it('should create classification with multiValue=true', async () => {
    const res = await adminClient.post<ClassificationResponse>('/classifications', {
      names: [{ locale: 'en', text: 'FE Multi Classification' }],
      assignableTo: 'BUSINESS_ENTITY',
      multiValue: true,
    });
    expect(res.status).toBe(201);
    expect(res.data.multiValue).toBe(true);
  });

  it('should default multiValue to false', async () => {
    const res = await adminClient.post<ClassificationResponse>('/classifications', {
      names: [{ locale: 'en', text: 'FE Single Classification Default' }],
      assignableTo: 'BUSINESS_ENTITY',
    });
    expect(res.status).toBe(201);
    expect(res.data.multiValue).toBe(false);
  });

  it('multi-value classification allows multiple assignments to same entity', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Tags Classification',
      'BUSINESS_ENTITY',
      [
        { key: 'tag-a', names: [{ locale: 'en', text: 'Tag A' }] },
        { key: 'tag-b', names: [{ locale: 'en', text: 'Tag B' }] },
      ],
    );
    // Patch multiValue on the classification (update it)
    await adminClient.put(`/classifications/${classif.key}`, {
      names: classif.names,
      assignableTo: classif.assignableTo,
      multiValue: true,
    });

    // Create an entity
    const entityRes = await adminClient.post('/business-entities', {
      names: [{ locale: 'en', text: 'FE Multi Assignment Entity' }],
    });
    const entityKey = entityRes.data.key;

    // Assign two values from the same multi-value classification
    const assignRes = await adminClient.put(`/business-entities/${entityKey}/classifications`, [
      { classificationKey: classif.key, valueKey: 'tag-a' },
      { classificationKey: classif.key, valueKey: 'tag-b' },
    ]);
    expect(assignRes.status).toBe(200);
  });

  it('single-value classification rejects duplicate assignments', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Single Enforcement Classification',
      'BUSINESS_ENTITY',
      [
        { key: 'sv-a', names: [{ locale: 'en', text: 'SV A' }] },
        { key: 'sv-b', names: [{ locale: 'en', text: 'SV B' }] },
      ],
    );
    // Ensure multiValue = false (default)

    const entityRes = await adminClient.post('/business-entities', {
      names: [{ locale: 'en', text: 'FE Single Enforcement Entity' }],
    });
    const entityKey = entityRes.data.key;

    // Attempt to assign two values from the same single-value classification
    const assignRes = await adminClient.put(`/business-entities/${entityKey}/classifications`, [
      { classificationKey: classif.key, valueKey: 'sv-a' },
      { classificationKey: classif.key, valueKey: 'sv-b' },
    ]);
    expect(assignRes.status).toBe(400);
  });
});
