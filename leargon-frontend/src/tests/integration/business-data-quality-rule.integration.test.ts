import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createEntity,
  ApiError,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { BusinessDataQualityRuleResponse } from '@/api/generated/model/businessDataQualityRuleResponse';
import type { BusinessEntityResponse } from '@/api/generated/model/businessEntityResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Business Data Quality Rule API', () => {
  let adminClient: AxiosInstance;
  let ownerClient: AxiosInstance;
  let otherClient: AxiosInstance;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    adminClient = createClient(baseUrl);
    ownerClient = createClient(baseUrl);
    otherClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'qr-admin@example.com',
      username: 'qradmin',
      password: 'password123',
      firstName: 'QR',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const ownerAuth = await signup(ownerClient, {
      email: 'qr-owner@example.com',
      username: 'qrowner',
      password: 'password123',
      firstName: 'QR',
      lastName: 'Owner',
    });
    withToken(ownerClient, ownerAuth.accessToken);

    const otherAuth = await signup(otherClient, {
      email: 'qr-other@example.com',
      username: 'qrother',
      password: 'password123',
      firstName: 'QR',
      lastName: 'Other',
    });
    withToken(otherClient, otherAuth.accessToken);
  });

  // ─── GET quality rules ─────────────────────────────────────────────────────

  it('returns empty list for entity with no rules', async () => {
    const entity = await createEntity(ownerClient, 'QR Empty Entity');
    const res = await ownerClient.get<BusinessDataQualityRuleResponse[]>(
      `/business-entities/${entity.key}/quality-rules`,
    );

    expect(res.status).toBe(200);
    expect(res.data).toEqual([]);
  });

  it('returns 404 for unknown entity', async () => {
    const res = await ownerClient.get('/business-entities/non-existent/quality-rules');
    expect(res.status).toBe(404);
  });

  it('returns 401 for unauthenticated request', async () => {
    const entity = await createEntity(ownerClient, 'QR Unauth Entity');
    const unauthClient = createClient(getBackendUrl());
    const res = await unauthClient.get(`/business-entities/${entity.key}/quality-rules`);
    expect(res.status).toBe(401);
  });

  // ─── POST quality rule ────────────────────────────────────────────────────

  it('owner can create a rule with description only', async () => {
    const entity = await createEntity(ownerClient, 'QR Desc Only Entity');
    const res = await ownerClient.post<BusinessDataQualityRuleResponse>(
      `/business-entities/${entity.key}/quality-rules`,
      { description: 'Name must not be blank or null' },
    );

    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.description).toBe('Name must not be blank or null');
    expect(res.data.severity).toBeNull();
    expect(res.data.createdAt).toBeTruthy();
  });

  it('owner can create a MUST rule', async () => {
    const entity = await createEntity(ownerClient, 'QR MUST Entity');
    const res = await ownerClient.post<BusinessDataQualityRuleResponse>(
      `/business-entities/${entity.key}/quality-rules`,
      { description: 'Customer must have a valid email address', severity: 'MUST' },
    );

    expect(res.status).toBe(201);
    expect(res.data.description).toBe('Customer must have a valid email address');
    expect(res.data.severity).toBe('MUST');
  });

  it('owner can create a SHOULD rule', async () => {
    const entity = await createEntity(ownerClient, 'QR SHOULD Entity');
    const res = await ownerClient.post<BusinessDataQualityRuleResponse>(
      `/business-entities/${entity.key}/quality-rules`,
      { description: 'Phone number should follow E.164 format', severity: 'SHOULD' },
    );

    expect(res.status).toBe(201);
    expect(res.data.severity).toBe('SHOULD');
  });

  it('owner can create a MAY rule', async () => {
    const entity = await createEntity(ownerClient, 'QR MAY Entity');
    const res = await ownerClient.post<BusinessDataQualityRuleResponse>(
      `/business-entities/${entity.key}/quality-rules`,
      { description: 'Middle name may be provided for legal purposes', severity: 'MAY' },
    );

    expect(res.status).toBe(201);
    expect(res.data.severity).toBe('MAY');
  });

  it('admin can create a rule on any entity', async () => {
    const entity = await createEntity(ownerClient, 'QR Admin Create Entity');
    const res = await adminClient.post<BusinessDataQualityRuleResponse>(
      `/business-entities/${entity.key}/quality-rules`,
      { description: 'Code must be unique across the system', severity: 'MUST' },
    );

    expect(res.status).toBe(201);
    expect(res.data.description).toBe('Code must be unique across the system');
  });

  it('returns 403 when non-owner tries to create a rule', async () => {
    const entity = await createEntity(ownerClient, 'QR Forbidden Create Entity');
    const res = await otherClient.post(
      `/business-entities/${entity.key}/quality-rules`,
      { description: 'Unauthorized rule attempt' },
    );

    expect(res.status).toBe(403);
  });

  it('returns 404 when creating rule for unknown entity', async () => {
    const res = await ownerClient.post(
      '/business-entities/non-existent/quality-rules',
      { description: 'Rule for missing entity' },
    );

    expect(res.status).toBe(404);
  });

  // ─── GET returns created rules ─────────────────────────────────────────────

  it('returns all rules created for an entity', async () => {
    const entity = await createEntity(ownerClient, 'QR Multi Rule Entity');
    await ownerClient.post(`/business-entities/${entity.key}/quality-rules`, {
      description: 'Age must be at least 18', severity: 'MUST',
    });
    await ownerClient.post(`/business-entities/${entity.key}/quality-rules`, {
      description: 'Email should follow RFC 5322',
    });

    const res = await ownerClient.get<BusinessDataQualityRuleResponse[]>(
      `/business-entities/${entity.key}/quality-rules`,
    );

    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(2);
    expect(res.data.some((r) => r.description === 'Age must be at least 18')).toBe(true);
    expect(res.data.some((r) => r.description === 'Email should follow RFC 5322')).toBe(true);
  });

  it('entity response includes qualityRules array', async () => {
    const entity = await createEntity(ownerClient, 'QR Embedded Rules Entity');
    await ownerClient.post(`/business-entities/${entity.key}/quality-rules`, {
      description: 'Status must be one of: ACTIVE, INACTIVE', severity: 'MUST',
    });

    const res = await ownerClient.get<BusinessEntityResponse>(`/business-entities/${entity.key}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.qualityRules)).toBe(true);
    expect(res.data.qualityRules).toHaveLength(1);
    expect(res.data.qualityRules![0].description).toBe('Status must be one of: ACTIVE, INACTIVE');
    expect(res.data.qualityRules![0].severity).toBe('MUST');
  });

  // ─── PUT quality rule ─────────────────────────────────────────────────────

  it('owner can update a quality rule', async () => {
    const entity = await createEntity(ownerClient, 'QR Update Entity');
    const created = await ownerClient.post<BusinessDataQualityRuleResponse>(
      `/business-entities/${entity.key}/quality-rules`,
      { description: 'Age must be set' },
    );
    const ruleId = created.data.id;

    const res = await ownerClient.put<BusinessDataQualityRuleResponse>(
      `/business-entities/${entity.key}/quality-rules/${ruleId}`,
      { description: 'Customer age must be at least 21', severity: 'MUST' },
    );

    expect(res.status).toBe(200);
    expect(res.data.description).toBe('Customer age must be at least 21');
    expect(res.data.severity).toBe('MUST');
    expect(res.data.updatedAt).toBeTruthy();
  });

  it('owner can clear severity by omitting it on update', async () => {
    const entity = await createEntity(ownerClient, 'QR Clear Severity Entity');
    const created = await ownerClient.post<BusinessDataQualityRuleResponse>(
      `/business-entities/${entity.key}/quality-rules`,
      { description: 'Age must be set', severity: 'MUST' },
    );
    const ruleId = created.data.id;

    const res = await ownerClient.put<BusinessDataQualityRuleResponse>(
      `/business-entities/${entity.key}/quality-rules/${ruleId}`,
      { description: 'Updated age rule' },
    );

    expect(res.status).toBe(200);
    expect(res.data.description).toBe('Updated age rule');
    expect(res.data.severity).toBeNull();
  });

  it('returns 403 when non-owner tries to update a rule', async () => {
    const entity = await createEntity(ownerClient, 'QR Forbidden Update Entity');
    const created = await ownerClient.post<BusinessDataQualityRuleResponse>(
      `/business-entities/${entity.key}/quality-rules`,
      { description: 'Age must be set' },
    );
    const ruleId = created.data.id;

    const res = await otherClient.put(
      `/business-entities/${entity.key}/quality-rules/${ruleId}`,
      { description: 'Unauthorized update' },
    );

    expect(res.status).toBe(403);
  });

  it('returns 404 when updating non-existent rule', async () => {
    const entity = await createEntity(ownerClient, 'QR 404 Update Entity');
    const res = await ownerClient.put(
      `/business-entities/${entity.key}/quality-rules/99999`,
      { description: 'Some rule' },
    );

    expect(res.status).toBe(404);
  });

  // ─── DELETE quality rule ───────────────────────────────────────────────────

  it('owner can delete a quality rule', async () => {
    const entity = await createEntity(ownerClient, 'QR Delete Entity');
    const created = await ownerClient.post<BusinessDataQualityRuleResponse>(
      `/business-entities/${entity.key}/quality-rules`,
      { description: 'Age must be set' },
    );
    const ruleId = created.data.id;

    const delRes = await ownerClient.delete(
      `/business-entities/${entity.key}/quality-rules/${ruleId}`,
    );
    expect(delRes.status).toBe(204);

    const listRes = await ownerClient.get<BusinessDataQualityRuleResponse[]>(
      `/business-entities/${entity.key}/quality-rules`,
    );
    expect(listRes.data).toHaveLength(0);
  });

  it('returns 403 when non-owner tries to delete a rule', async () => {
    const entity = await createEntity(ownerClient, 'QR Forbidden Delete Entity');
    const created = await ownerClient.post<BusinessDataQualityRuleResponse>(
      `/business-entities/${entity.key}/quality-rules`,
      { description: 'Age must be set' },
    );
    const ruleId = created.data.id;

    const res = await otherClient.delete(
      `/business-entities/${entity.key}/quality-rules/${ruleId}`,
    );
    expect(res.status).toBe(403);
  });

  it('returns 404 when deleting non-existent rule', async () => {
    const entity = await createEntity(ownerClient, 'QR 404 Delete Entity');
    const res = await ownerClient.delete(
      `/business-entities/${entity.key}/quality-rules/99999`,
    );
    expect(res.status).toBe(404);
  });

  // ─── Export ────────────────────────────────────────────────────────────────

  it('admin can export quality rules as CSV with description and severity', async () => {
    const entity = await createEntity(ownerClient, 'QR Export Entity');
    await ownerClient.post(`/business-entities/${entity.key}/quality-rules`, {
      description: 'Customer must be at least 18 years old', severity: 'MUST',
    });

    const res = await adminClient.get<string>('/export/business-data-quality-rules', {
      responseType: 'text',
    });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.data).toContain('Customer must be at least 18 years old');
    expect(res.data).toContain('MUST');
    expect(res.data).toContain('Description');
    expect(res.data).toContain('Severity');
  });

  it('export CSV does not contain legacy constraint type fields', async () => {
    const entity = await createEntity(ownerClient, 'QR Export No Constraint Entity');
    await ownerClient.post(`/business-entities/${entity.key}/quality-rules`, {
      description: 'Phone should follow E.164 format', severity: 'SHOULD',
    });

    const res = await adminClient.get<string>('/export/business-data-quality-rules', {
      responseType: 'text',
    });

    expect(res.status).toBe(200);
    expect(res.data).not.toContain('Field Name');
    expect(res.data).not.toContain('Constraint Type');
    expect(res.data).not.toContain('Constraint Value');
  });

  it('non-admin cannot export quality rules', async () => {
    const res = await ownerClient.get('/export/business-data-quality-rules');
    expect(res.status).toBe(403);
  });
});
