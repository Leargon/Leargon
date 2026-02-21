import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createEntity,
  createDomain,
  createClassification,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { BusinessEntityResponse } from '@/api/generated/model/businessEntityResponse';
import type { BusinessEntityVersionResponse } from '@/api/generated/model/businessEntityVersionResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Business Entity E2E', () => {
  let client: AxiosInstance;
  let token: string;

  beforeAll(async () => {
    client = createClient(getBackendUrl());

    const auth = await signup(client, {
      email: 'fe-ent-user@example.com',
      username: 'feentuser',
      password: 'password123',
      firstName: 'Entity',
      lastName: 'Tester',
    });
    token = auth.accessToken;
    withToken(client, token);
  });

  // =====================
  // CREATE
  // =====================

  it('should create entity with name-based key', async () => {
    const entity = await createEntity(client, 'FE Customer');
    expect(entity.key).toBe('fe-customer');
    expect(entity.dataOwner.username).toBe('feentuser');
    expect(entity.createdBy.username).toBe('feentuser');
  });

  it('should create child entity with parent', async () => {
    const parent = await createEntity(client, 'FE Parent Entity');

    const res = await client.post<BusinessEntityResponse>('/business-entities', {
      names: [{ locale: 'en', text: 'FE Child Entity' }],
      parentKey: parent.key,
    });
    expect(res.status).toBe(201);
    expect(res.data.parent?.key).toBe(parent.key);
  });

  // =====================
  // READ
  // =====================

  it('should list all entities', async () => {
    await createEntity(client, 'FE List Entity A');
    await createEntity(client, 'FE List Entity B');

    const res = await client.get<BusinessEntityResponse[]>('/business-entities');
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should get entity by key', async () => {
    const entity = await createEntity(client, 'FE Gettable Entity');

    const res = await client.get<BusinessEntityResponse>(
      `/business-entities/${entity.key}`,
    );
    expect(res.status).toBe(200);
    expect(res.data.key).toBe(entity.key);
  });

  it('should return 404 for non-existent entity', async () => {
    const res = await client.get('/business-entities/nonexistent-fe-key');
    expect(res.status).toBe(404);
  });

  // =====================
  // UPDATE NAMES
  // =====================

  it('should update entity names and recompute key', async () => {
    const entity = await createEntity(client, 'FE Old Entity Name');

    const res = await client.put(`/business-entities/${entity.key}/names`, [
      { locale: 'en', text: 'FE New Entity Name' },
    ]);
    expect(res.status).toBe(200);
    expect(res.data.key).toBe('fe-new-entity-name');
    expect(res.data.names[0].text).toBe('FE New Entity Name');
  });

  // =====================
  // UPDATE DESCRIPTIONS
  // =====================

  it('should update entity descriptions', async () => {
    const entity = await createEntity(client, 'FE Desc Entity');

    const res = await client.put(`/business-entities/${entity.key}/descriptions`, [
      { locale: 'en', text: 'A great FE entity description' },
    ]);
    expect(res.status).toBe(200);
    expect(res.data.descriptions.length).toBe(1);
    expect(res.data.descriptions[0].text).toBe('A great FE entity description');
  });

  // =====================
  // UPDATE DATA OWNER
  // =====================

  it('should change data owner', async () => {
    // Create a second user
    const secondClient = createClient(getBackendUrl());
    const secondAuth = await signup(secondClient, {
      email: 'fe-ent-newowner@example.com',
      username: 'feentnewowner',
      password: 'password123',
      firstName: 'New',
      lastName: 'Owner',
    });

    const entity = await createEntity(client, 'FE Ownership Entity');

    const res = await client.put(`/business-entities/${entity.key}/data-owner`, {
      dataOwnerUsername: 'feentnewowner',
    });
    expect(res.status).toBe(200);
    expect(res.data.dataOwner.username).toBe('feentnewowner');

    // Verify new owner can edit
    const ownerClient = createClient(getBackendUrl());
    withToken(ownerClient, secondAuth.accessToken);
    const editRes = await ownerClient.put(
      `/business-entities/${res.data.key}/descriptions`,
      [{ locale: 'en', text: 'Owner edited this' }],
    );
    expect(editRes.status).toBe(200);

    // Verify old owner gets 403
    const forbiddenRes = await client.put(
      `/business-entities/${res.data.key}/descriptions`,
      [{ locale: 'en', text: 'Should fail' }],
    );
    expect(forbiddenRes.status).toBe(403);
  });

  // =====================
  // RELATIONSHIPS
  // =====================

  it('should create and delete a relationship', async () => {
    const entity1 = await createEntity(client, 'FE Order Entity');
    const entity2 = await createEntity(client, 'FE Product Entity');

    // Create relationship
    const createRes = await client.post(
      `/business-entities/${entity1.key}/relationships`,
      {
        secondBusinessEntityKey: entity2.key,
        firstCardinalityMinimum: 1,
        firstCardinalityMaximum: 1,
        secondCardinalityMinimum: 0,
        descriptions: [{ locale: 'en', text: 'Order contains products' }],
      },
    );
    expect(createRes.status).toBe(201);
    const relId = createRes.data.id;

    // Delete relationship — entity survives
    const delRes = await client.delete(
      `/business-entities/${entity1.key}/relationships/${relId}`,
    );
    expect(delRes.status).toBe(204);

    // Both entities still exist
    const e1Res = await client.get(`/business-entities/${entity1.key}`);
    expect(e1Res.status).toBe(200);
    const e2Res = await client.get(`/business-entities/${entity2.key}`);
    expect(e2Res.status).toBe(200);
  });

  // =====================
  // INTERFACES
  // =====================

  it('should assign interfaces to entity', async () => {
    const ifaceEntity = await createEntity(client, 'FE Interface API');
    const implEntity = await createEntity(client, 'FE Implementation');

    const res = await client.put(
      `/business-entities/${implEntity.key}/interfaces`,
      [{ interfaceEntityKey: ifaceEntity.key }],
    );
    expect(res.status).toBe(200);
  });

  // =====================
  // DOMAIN ASSIGNMENT
  // =====================

  it('should assign entity to a business domain', async () => {
    const adminClient = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-ent-domain@example.com',
      username: 'feentdomain',
      password: 'password123',
      firstName: 'Domain',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const domain = await createDomain(adminClient, 'FE Sales Domain');
    const entity = await createEntity(adminClient, 'FE Domain Entity');

    const res = await adminClient.put(
      `/business-entities/${entity.key}/domain`,
      { businessDomainKey: domain.key },
    );
    expect(res.status).toBe(200);
    expect(res.data.businessDomain.key).toBe(domain.key);
  });

  // =====================
  // CLASSIFICATION ASSIGNMENT
  // =====================

  it('should assign classification to entity', async () => {
    const adminClient = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-ent-classif@example.com',
      username: 'feentclassif',
      password: 'password123',
      firstName: 'Classif',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const classif = await createClassification(
      adminClient,
      'FE Entity Priority',
      'BUSINESS_ENTITY',
      [
        { key: 'high', names: [{ locale: 'en', text: 'High' }] },
        { key: 'low', names: [{ locale: 'en', text: 'Low' }] },
      ],
    );
    const entity = await createEntity(adminClient, 'FE Classified Entity');

    const res = await adminClient.put(
      `/business-entities/${entity.key}/classifications`,
      [{ classificationKey: classif.key, valueKey: 'high' }],
    );
    expect(res.status).toBe(200);
    expect(res.data.classificationAssignments.length).toBe(1);
    expect(res.data.classificationAssignments[0].classificationKey).toBe(classif.key);
    expect(res.data.classificationAssignments[0].valueKey).toBe('high');
  });

  // =====================
  // VERSION HISTORY
  // =====================

  it('should track version history through create and updates', async () => {
    const entity = await createEntity(client, 'FE Versioned Entity');
    const entityKey = entity.key;

    // Update names to create version 2
    const updateRes = await client.put(
      `/business-entities/${entityKey}/names`,
      [{ locale: 'en', text: 'FE Updated Versioned' }],
    );
    const updatedKey = updateRes.data.key;

    const versionsRes = await client.get<BusinessEntityVersionResponse[]>(
      `/business-entities/${updatedKey}/versions`,
    );
    expect(versionsRes.status).toBe(200);
    expect(versionsRes.data.length).toBe(2);
    expect(versionsRes.data.some((v) => v.changeType === 'CREATE')).toBe(true);
    expect(versionsRes.data.some((v) => v.changeType === 'UPDATE')).toBe(true);
  });

  // =====================
  // DELETE
  // =====================

  it('should delete entity and return 404 on re-fetch', async () => {
    const entity = await createEntity(client, 'FE Deletable Entity');

    const delRes = await client.delete(`/business-entities/${entity.key}`);
    expect(delRes.status).toBe(204);

    const getRes = await client.get(`/business-entities/${entity.key}`);
    expect(getRes.status).toBe(404);
  });
});
