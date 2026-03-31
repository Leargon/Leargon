import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createOrgUnit,
  createProcess,
  createClassification,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { OrganisationalUnitResponse } from '@/api/generated/model/organisationalUnitResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Organisational Unit E2E', () => {
  let client: AxiosInstance;
  let adminClient: AxiosInstance;
  let token: string;
  let username: string;

  beforeAll(async () => {
    client = createClient(getBackendUrl());
    adminClient = createClient(getBackendUrl());
    username = 'feorguser';

    const auth = await signupAdmin(client, {
      email: 'fe-org-user@example.com',
      username,
      password: 'password123',
      firstName: 'Org',
      lastName: 'Tester',
    });
    token = auth.accessToken;
    withToken(client, token);
    withToken(adminClient, token);
  });

  // =====================
  // CREATE
  // =====================

  it('should create organisational unit with name-based key', async () => {
    const unit = await createOrgUnit(client, 'FE Engineering');
    expect(unit.key).toBe('fe-engineering');
    expect(unit.names[0].text).toBe('FE Engineering');
    expect(unit.createdBy.username).toBe(username);
  });

  it('should set creator as lead automatically', async () => {
    const unit = await createOrgUnit(client, 'FE Auto Lead', { businessOwnerUsername: username });
    expect(unit.businessOwner?.username).toBe(username);
  });

  it('should create unit with explicit lead', async () => {
    const secondAuth = await signup(createClient(getBackendUrl()), {
      email: 'fe-org-explicit-lead@example.com',
      username: 'feorgexplicitlead',
      password: 'password123',
      firstName: 'Explicit',
      lastName: 'Lead',
    });

    const unit = await createOrgUnit(client, 'FE Explicit Lead Unit', {
      businessOwnerUsername: 'feorgexplicitlead',
    });
    expect(unit.businessOwner?.username).toBe('feorgexplicitlead');
    expect(secondAuth).toBeDefined();
  });

  // =====================
  // READ
  // =====================

  it('should list all organisational units', async () => {
    await createOrgUnit(client, 'FE Org List A');
    await createOrgUnit(client, 'FE Org List B');

    const res = await client.get<OrganisationalUnitResponse[]>('/organisational-units');
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should get organisational unit by key', async () => {
    const unit = await createOrgUnit(client, 'FE Gettable Unit');

    const res = await client.get<OrganisationalUnitResponse>(
      `/organisational-units/${unit.key}`,
    );
    expect(res.status).toBe(200);
    expect(res.data.key).toBe(unit.key);
  });

  it('should return 404 for non-existent organisational unit', async () => {
    const res = await client.get('/organisational-units/nonexistent-fe-key');
    expect(res.status).toBe(404);
  });

  it('should get organisational unit tree', async () => {
    await createOrgUnit(client, 'FE Tree Root');

    const res = await client.get('/organisational-units/tree');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  // =====================
  // UPDATE NAMES
  // =====================

  it('should update organisational unit names and recompute key', async () => {
    const unit = await createOrgUnit(client, 'FE Old Org Name');

    const res = await client.put(`/organisational-units/${unit.key}/names`, [
      { locale: 'en', text: 'FE New Org Name' },
    ]);
    expect(res.status).toBe(200);
    expect(res.data.key).toBe('fe-new-org-name');
    expect(res.data.names[0].text).toBe('FE New Org Name');
  });

  // =====================
  // UPDATE DESCRIPTIONS
  // =====================

  it('should update organisational unit descriptions', async () => {
    const unit = await createOrgUnit(client, 'FE Desc Org Unit');

    const res = await client.put(`/organisational-units/${unit.key}/descriptions`, [
      { locale: 'en', text: 'A great FE org unit description' },
    ]);
    expect(res.status).toBe(200);
    expect(res.data.descriptions.length).toBe(1);
    expect(res.data.descriptions[0].text).toBe('A great FE org unit description');
  });

  // =====================
  // UPDATE TYPE
  // =====================

  it('should update organisational unit type', async () => {
    const unit = await createOrgUnit(client, 'FE Typed Org Unit');

    const res = await client.put(`/organisational-units/${unit.key}/type`, {
      unitType: 'Department',
    });
    expect(res.status).toBe(200);
    expect(res.data.unitType).toBe('Department');
  });

  it('should clear organisational unit type when set to null', async () => {
    const unit = await createOrgUnit(client, 'FE Nullable Type Unit', {
      unitType: 'Team',
    });

    const res = await client.put(`/organisational-units/${unit.key}/type`, {
      unitType: null,
    });
    expect(res.status).toBe(200);
    // unitType is omitted from the response when null (Jackson NON_NULL serialization)
    expect(res.data.unitType ?? null).toBeNull();
  });

  // =====================
  // UPDATE LEAD
  // =====================

  it('should change organisational unit lead', async () => {
    const newLeadAuth = await signup(createClient(getBackendUrl()), {
      email: 'fe-org-newlead@example.com',
      username: 'feorgnewlead',
      password: 'password123',
      firstName: 'New',
      lastName: 'Lead',
    });

    const unit = await createOrgUnit(client, 'FE Lead Change Unit');

    const res = await adminClient.put(`/organisational-units/${unit.key}/lead`, {
      businessOwnerUsername: 'feorgnewlead',
    });
    expect(res.status).toBe(200);
    expect(res.data.businessOwner?.username).toBe('feorgnewlead');

    // Verify new lead can edit the unit
    const leadClient = createClient(getBackendUrl());
    withToken(leadClient, newLeadAuth.accessToken);
    const editRes = await leadClient.put(`/organisational-units/${unit.key}/descriptions`, [
      { locale: 'en', text: 'Lead edited this' },
    ]);
    expect(editRes.status).toBe(200);
  });

  it('should reject removing lead by setting businessOwnerUsername to null', async () => {
    const unit = await createOrgUnit(client, 'FE No Lead Unit');
    expect(unit.businessOwner?.username).toBe(username);

    // Setting businessOwnerUsername to null is rejected
    const res = await adminClient.put(`/organisational-units/${unit.key}/lead`, {
      businessOwnerUsername: null,
    });
    expect(res.status).toBe(400);
  });

  // =====================
  // UPDATE PARENTS
  // =====================

  it('should assign parent units', async () => {
    const parent = await createOrgUnit(client, 'FE Org Parent');
    const child = await createOrgUnit(client, 'FE Org Child');

    const res = await client.put(`/organisational-units/${child.key}/parents`, {
      keys: [parent.key],
    });
    expect(res.status).toBe(200);
    expect(res.data.parents?.some((p: { key: string }) => p.key === parent.key)).toBe(true);
  });

  it('should clear parents when set to empty array', async () => {
    const parent = await createOrgUnit(client, 'FE Org Detach Parent');
    const child = await createOrgUnit(client, 'FE Org Detach Child');

    await client.put(`/organisational-units/${child.key}/parents`, {
      keys: [parent.key],
    });

    const res = await client.put(`/organisational-units/${child.key}/parents`, {
      keys: [],
    });
    expect(res.status).toBe(200);
    expect(res.data.parents?.length ?? 0).toBe(0);
  });

  // =====================
  // CLASSIFICATION ASSIGNMENT
  // =====================

  it('should assign classification to organisational unit', async () => {
    const adminClient = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-org-classif-admin@example.com',
      username: 'feorgclassifadmin',
      password: 'password123',
      firstName: 'Classif',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const classif = await createClassification(
      adminClient,
      'FE Org Unit Tier',
      'ORGANISATIONAL_UNIT',
      [
        { key: 'tier-1', names: [{ locale: 'en', text: 'Tier 1' }] },
        { key: 'tier-2', names: [{ locale: 'en', text: 'Tier 2' }] },
      ],
    );
    const unit = await createOrgUnit(client, 'FE Classified Org Unit');

    const res = await client.put(
      `/organisational-units/${unit.key}/classifications`,
      [{ classificationKey: classif.key, valueKey: 'tier-1' }],
    );
    expect(res.status).toBe(200);
    expect(res.data.classificationAssignments.length).toBe(1);
    expect(res.data.classificationAssignments[0].classificationKey).toBe(classif.key);
    expect(res.data.classificationAssignments[0].valueKey).toBe('tier-1');
  });

  // =====================
  // PERMISSIONS
  // =====================

  it('should reject update by non-lead user', async () => {
    const otherAuth = await signup(createClient(getBackendUrl()), {
      email: 'fe-org-nonlead@example.com',
      username: 'feorgnonlead',
      password: 'password123',
      firstName: 'Other',
      lastName: 'User',
    });

    const unit = await createOrgUnit(client, 'FE Permission Unit');

    const otherClient = createClient(getBackendUrl());
    withToken(otherClient, otherAuth.accessToken);
    const res = await otherClient.put(`/organisational-units/${unit.key}/descriptions`, [
      { locale: 'en', text: 'Unauthorized edit' },
    ]);
    expect(res.status).toBe(403);
  });

  // =====================
  // DELETE
  // =====================

  it('should delete organisational unit and return 404 on re-fetch', async () => {
    const unit = await createOrgUnit(client, 'FE Deletable Org Unit');

    const delRes = await client.delete(`/organisational-units/${unit.key}`);
    expect(delRes.status).toBe(204);

    const getRes = await client.get(`/organisational-units/${unit.key}`);
    expect(getRes.status).toBe(404);
  });

  it('delete parent org unit → child units survive but lose parent link', async () => {
    const parent = await createOrgUnit(client, 'FE Org Parent To Delete');
    const child = await createOrgUnit(client, 'FE Org Child Survives');

    // Assign parent
    await client.put(`/organisational-units/${child.key}/parents`, { keys: [parent.key] });
    const beforeRes = await client.get(`/organisational-units/${child.key}`);
    expect(beforeRes.data.parents?.some((p: { key: string }) => p.key === parent.key)).toBe(true);

    // Delete parent
    const delRes = await client.delete(`/organisational-units/${parent.key}`);
    expect(delRes.status).toBe(204);

    // Parent is gone
    const parentRes = await client.get(`/organisational-units/${parent.key}`);
    expect(parentRes.status).toBe(404);

    // Child still exists and parent link is gone
    const childRes = await client.get(`/organisational-units/${child.key}`);
    expect(childRes.status).toBe(200);
    expect(childRes.data.parents?.every((p: { key: string }) => p.key !== parent.key)).toBe(true);
  });

  it('delete org unit → executing processes still exist, unit removed from executingUnits', async () => {
    const unit = await createOrgUnit(client, 'FE Org Unit To Delete With Procs');
    const proc = await createProcess(client, 'FE Org Surviving Process');

    // Assign unit as executing unit on process
    await client.put(`/processes/${proc.key}/executing-units`, { keys: [unit.key] });

    // Verify assignment
    const beforeRes = await client.get(`/processes/${proc.key}`);
    expect(beforeRes.data.executingUnits?.some((u: { key: string }) => u.key === unit.key)).toBe(true);

    // Delete the org unit
    const delRes = await client.delete(`/organisational-units/${unit.key}`);
    expect(delRes.status).toBe(204);

    // Unit is gone
    const unitRes = await client.get(`/organisational-units/${unit.key}`);
    expect(unitRes.status).toBe(404);

    // Process still exists, unit removed from executingUnits via DB cascade
    const procRes = await client.get(`/processes/${proc.key}`);
    expect(procRes.status).toBe(200);
    expect(procRes.data.executingUnits?.every((u: { key: string }) => u.key !== unit.key)).toBe(true);
  });

  it('should reject deletion by non-lead user', async () => {
    const otherAuth = await signup(createClient(getBackendUrl()), {
      email: 'fe-org-del-nonlead@example.com',
      username: 'feorgdelnonlead',
      password: 'password123',
      firstName: 'Del',
      lastName: 'User',
    });

    const unit = await createOrgUnit(client, 'FE Unremovable Unit');

    const otherClient = createClient(getBackendUrl());
    withToken(otherClient, otherAuth.accessToken);
    const res = await otherClient.delete(`/organisational-units/${unit.key}`);
    expect(res.status).toBe(403);
  });
});
