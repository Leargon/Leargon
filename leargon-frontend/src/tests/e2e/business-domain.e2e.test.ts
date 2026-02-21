import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createDomain,
  createClassification,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { BusinessDomainResponse } from '@/api/generated/model/businessDomainResponse';
import type { BusinessDomainVersionResponse } from '@/api/generated/model/businessDomainVersionResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Business Domain E2E', () => {
  let adminClient: AxiosInstance;
  let adminToken: string;

  beforeAll(async () => {
    adminClient = createClient(getBackendUrl());

    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-dom-admin@example.com',
      username: 'fedomadmin',
      password: 'password123',
      firstName: 'Domain',
      lastName: 'Admin',
    });
    adminToken = adminAuth.accessToken;
    withToken(adminClient, adminToken);
  });

  // =====================
  // CREATE
  // =====================

  it('should create domain as admin with key', async () => {
    const domain = await createDomain(adminClient, 'FE Sales');
    expect(domain.key).toBe('fe-sales');
    expect(domain.names.length).toBe(1);
    expect(domain.names[0].text).toBe('FE Sales');
  });

  it('should reject domain creation by non-admin', async () => {
    const userClient = createClient(getBackendUrl());
    const userAuth = await signup(userClient, {
      email: 'fe-dom-nonadmin@example.com',
      username: 'fedomnonadmin',
      password: 'password123',
      firstName: 'Regular',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);

    const res = await userClient.post('/business-domains', {
      names: [{ locale: 'en', text: 'Unauthorized FE Domain' }],
    });
    expect(res.status).toBe(403);
  });

  it('should create subdomain with hierarchical key', async () => {
    const parent = await createDomain(adminClient, 'FE Parent Domain');

    const res = await adminClient.post<BusinessDomainResponse>('/business-domains', {
      names: [{ locale: 'en', text: 'FE Sub Domain' }],
      parentKey: parent.key,
    });
    expect(res.status).toBe(201);
    expect(res.data.parent?.key).toBe(parent.key);
    expect(res.data.key).toBe(`${parent.key}.fe-sub-domain`);
  });

  // =====================
  // READ
  // =====================

  it('should list all domains', async () => {
    await createDomain(adminClient, 'FE Domain List A');
    await createDomain(adminClient, 'FE Domain List B');

    const res = await adminClient.get<BusinessDomainResponse[]>('/business-domains');
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should get domain by key', async () => {
    const domain = await createDomain(adminClient, 'FE Readable Domain');

    const res = await adminClient.get<BusinessDomainResponse>(
      `/business-domains/${domain.key}`,
    );
    expect(res.status).toBe(200);
    expect(res.data.key).toBe(domain.key);
  });

  it('should return 404 for non-existent domain', async () => {
    const res = await adminClient.get('/business-domains/nonexistent-fe-key');
    expect(res.status).toBe(404);
  });

  // =====================
  // UPDATE NAMES
  // =====================

  it('should update domain names', async () => {
    const domain = await createDomain(adminClient, 'FE Old Domain Name');

    const res = await adminClient.put(`/business-domains/${domain.key}/names`, [
      { locale: 'en', text: 'FE New Domain Name' },
      { locale: 'de', text: 'FE Neuer Domänenname' },
    ]);
    expect(res.status).toBe(200);
    expect(res.data.names.length).toBe(2);
    expect(res.data.names.some((n: { text: string }) => n.text === 'FE New Domain Name')).toBe(
      true,
    );
  });

  // =====================
  // UPDATE DESCRIPTIONS
  // =====================

  it('should update domain descriptions', async () => {
    const domain = await createDomain(adminClient, 'FE Desc Domain');

    const res = await adminClient.put(`/business-domains/${domain.key}/descriptions`, [
      { locale: 'en', text: 'FE domain description' },
    ]);
    expect(res.status).toBe(200);
    expect(res.data.descriptions.length).toBe(1);
    expect(res.data.descriptions[0].text).toBe('FE domain description');
  });

  // =====================
  // UPDATE TYPE
  // =====================

  it('should update domain type', async () => {
    const domain = await createDomain(adminClient, 'FE Typed Domain');

    const res = await adminClient.put(`/business-domains/${domain.key}/type`, {
      type: 'GENERIC',
    });
    expect(res.status).toBe(200);
    expect(res.data.type).toBe('GENERIC');
    expect(res.data.effectiveType).toBe('GENERIC');
  });

  // =====================
  // REPARENT
  // =====================

  it('should reparent domain and change key', async () => {
    const parent1 = await createDomain(adminClient, 'FE Parent One');
    const parent2 = await createDomain(adminClient, 'FE Parent Two');
    const child = await createDomain(adminClient, 'FE Reparent Child', {
      parentKey: parent1.key,
    });

    const res = await adminClient.put(`/business-domains/${child.key}/parent`, {
      parentKey: parent2.key,
    });
    expect(res.status).toBe(200);
    expect(res.data.parent.key).toBe(parent2.key);
  });

  // =====================
  // CLASSIFICATION ASSIGNMENT
  // =====================

  it('should assign classification to domain', async () => {
    const classif = await createClassification(
      adminClient,
      'FE Domain Sensitivity',
      'BUSINESS_DOMAIN',
      [
        { key: 'public', names: [{ locale: 'en', text: 'Public' }] },
        { key: 'private', names: [{ locale: 'en', text: 'Private' }] },
      ],
    );
    const domain = await createDomain(adminClient, 'FE Classified Domain');

    const res = await adminClient.put(
      `/business-domains/${domain.key}/classifications`,
      [{ classificationKey: classif.key, valueKey: 'public' }],
    );
    expect(res.status).toBe(200);
    expect(res.data.classificationAssignments.length).toBe(1);
    expect(res.data.classificationAssignments[0].classificationKey).toBe(classif.key);
    expect(res.data.classificationAssignments[0].valueKey).toBe('public');
  });

  // =====================
  // VERSION HISTORY
  // =====================

  it('should track domain version history', async () => {
    const domain = await createDomain(adminClient, 'FE Versioned Domain');

    // Update names to create version 2
    const updateRes = await adminClient.put(
      `/business-domains/${domain.key}/names`,
      [{ locale: 'en', text: 'FE Updated Versioned Domain' }],
    );
    const updatedKey = updateRes.data.key;

    const versionsRes = await adminClient.get<BusinessDomainVersionResponse[]>(
      `/business-domains/${updatedKey}/versions`,
    );
    expect(versionsRes.status).toBe(200);
    expect(versionsRes.data.length).toBe(2);
    expect(versionsRes.data.some((v) => v.changeType === 'CREATE')).toBe(true);
    expect(versionsRes.data.some((v) => v.changeType === 'UPDATE')).toBe(true);
  });

  // =====================
  // DELETE
  // =====================

  it('should delete domain and return 404 on re-fetch', async () => {
    const domain = await createDomain(adminClient, 'FE Deletable Domain');

    const delRes = await adminClient.delete(`/business-domains/${domain.key}`);
    expect(delRes.status).toBe(204);

    const getRes = await adminClient.get(`/business-domains/${domain.key}`);
    expect(getRes.status).toBe(404);
  });

  it('should detach subdomains when parent is deleted', async () => {
    const parent = await createDomain(adminClient, 'FE Detach Parent');
    await createDomain(adminClient, 'FE Detach Child', {
      parentKey: parent.key,
    });

    // Delete parent
    await adminClient.delete(`/business-domains/${parent.key}`);

    // Child still exists with no parent and recomputed key
    const childRes = await adminClient.get<BusinessDomainResponse>(
      '/business-domains/fe-detach-child',
    );
    expect(childRes.status).toBe(200);
    expect(childRes.data.parent).toBeUndefined();
    expect(childRes.data.key).toBe('fe-detach-child');
  });

  it('should detach entities from domain when domain is deleted', async () => {
    const domain = await createDomain(adminClient, 'FE Ephemeral Domain');
    const entity = await (async () => {
      const body = { names: [{ locale: 'en', text: 'FE Domain Bound Entity' }] };
      const res = await adminClient.post('/business-entities', body);
      return res.data;
    })();

    // Assign entity to domain
    await adminClient.put(`/business-entities/${entity.key}/domain`, {
      businessDomainKey: domain.key,
    });

    // Delete domain
    await adminClient.delete(`/business-domains/${domain.key}`);

    // Entity still exists but domain is null
    const entityRes = await adminClient.get(`/business-entities/${entity.key}`);
    expect(entityRes.status).toBe(200);
    expect(entityRes.data.businessDomain).toBeNull();
  });
});
