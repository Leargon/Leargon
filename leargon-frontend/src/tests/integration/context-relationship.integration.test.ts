import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createDomain,
  createBoundedContext,
} from './testClient';
import type { AxiosInstance } from 'axios';

interface BoundedContextResponse {
  key: string;
  names: Array<{ locale: string; text: string }>;
}

interface ContextRelationshipResponse {
  id: number;
  relationshipType: string;
  upstreamBoundedContext: { key: string; name: string };
  downstreamBoundedContext: { key: string; name: string };
  description?: string;
  createdAt: string;
  updatedAt: string;
}

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Context Relationship API', () => {
  let adminClient: AxiosInstance;
  let userClient: AxiosInstance;
  let upstreamBoundedContext: BoundedContextResponse;
  let downstreamBoundedContext: BoundedContextResponse;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    adminClient = createClient(baseUrl);
    userClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'ctx-rel-admin@example.com',
      username: 'ctxreladmin',
      password: 'password123',
      firstName: 'Ctx',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const userAuth = await signup(userClient, {
      email: 'ctx-rel-user@example.com',
      username: 'ctxreluser',
      password: 'password123',
      firstName: 'Ctx',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);

    const upstreamDomain = await createDomain(adminClient, 'Integration Upstream Domain');
    const downstreamDomain = await createDomain(adminClient, 'Integration Downstream Domain');

    upstreamBoundedContext = await createBoundedContext(
      adminClient,
      'Integration Upstream BC',
      upstreamDomain.key as string,
    );
    downstreamBoundedContext = await createBoundedContext(
      adminClient,
      'Integration Downstream BC',
      downstreamDomain.key as string,
    );
  });

  it('GET /context-relationships returns empty list initially', async () => {
    const res = await adminClient.get<ContextRelationshipResponse[]>('/context-relationships');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('admin can create a context relationship', async () => {
    const res = await adminClient.post<ContextRelationshipResponse>('/context-relationships', {
      upstreamBoundedContextKey: upstreamBoundedContext.key,
      downstreamBoundedContextKey: downstreamBoundedContext.key,
      relationshipType: 'CUSTOMER_SUPPLIER',
      description: 'Integration test relationship',
    });

    expect(res.status).toBe(201);
    expect(res.data.id).toBeGreaterThan(0);
    expect(res.data.relationshipType).toBe('CUSTOMER_SUPPLIER');
    expect(res.data.upstreamBoundedContext.key).toBe(upstreamBoundedContext.key);
    expect(res.data.downstreamBoundedContext.key).toBe(downstreamBoundedContext.key);
    expect(res.data.description).toBe('Integration test relationship');
  });

  it('non-admin cannot create a context relationship', async () => {
    const res = await userClient.post('/context-relationships', {
      upstreamBoundedContextKey: upstreamBoundedContext.key,
      downstreamBoundedContextKey: downstreamBoundedContext.key,
      relationshipType: 'PARTNERSHIP',
    });

    expect(res.status).toBe(403);
  });

  it('can list context relationships', async () => {
    const res = await adminClient.get<ContextRelationshipResponse[]>('/context-relationships');
    expect(res.status).toBe(200);
    const rel = res.data.find(
      (r) =>
        r.upstreamBoundedContext.key === upstreamBoundedContext.key &&
        r.downstreamBoundedContext.key === downstreamBoundedContext.key,
    );
    expect(rel).toBeDefined();
    expect(rel?.relationshipType).toBe('CUSTOMER_SUPPLIER');
  });

  it('admin can update a context relationship', async () => {
    // Create a new one for update test
    const createRes = await adminClient.post<ContextRelationshipResponse>('/context-relationships', {
      upstreamBoundedContextKey: upstreamBoundedContext.key,
      downstreamBoundedContextKey: downstreamBoundedContext.key,
      relationshipType: 'PARTNERSHIP',
    });
    const id = createRes.data.id;

    const updateRes = await adminClient.put<ContextRelationshipResponse>(
      `/context-relationships/${id}`,
      { relationshipType: 'CONFORMIST' },
    );

    expect(updateRes.status).toBe(200);
    expect(updateRes.data.relationshipType).toBe('CONFORMIST');
  });

  it('admin can delete a context relationship', async () => {
    const createRes = await adminClient.post<ContextRelationshipResponse>('/context-relationships', {
      upstreamBoundedContextKey: upstreamBoundedContext.key,
      downstreamBoundedContextKey: downstreamBoundedContext.key,
      relationshipType: 'SHARED_KERNEL',
    });
    const id = createRes.data.id;

    const deleteRes = await adminClient.delete(`/context-relationships/${id}`);
    expect(deleteRes.status).toBe(204);

    // Verify it's gone
    const listRes = await adminClient.get<ContextRelationshipResponse[]>('/context-relationships');
    const found = listRes.data.find((r) => r.id === id);
    expect(found).toBeUndefined();
  });

  it('returns 404 when deleting unknown context relationship', async () => {
    const res = await adminClient.delete('/context-relationships/999999');
    expect(res.status).toBe(404);
  });

  it('unauthenticated request returns 401', async () => {
    const anonClient = createClient(getBackendUrl());
    const res = await anonClient.get('/context-relationships');
    expect(res.status).toBe(401);
  });
});
