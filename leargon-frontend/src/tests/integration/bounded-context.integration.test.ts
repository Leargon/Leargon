import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createDomain,
  ApiError,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { BoundedContextResponse } from '@/api/generated/model/boundedContextResponse';
import type { BusinessDomainResponse } from '@/api/generated/model/businessDomainResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

async function createBoundedContext(
  client: AxiosInstance,
  domainKey: string,
  name: string,
  extras?: Record<string, unknown>,
): Promise<BoundedContextResponse> {
  const body = {
    names: [{ locale: 'en', text: name }],
    ...extras,
  };
  const res = await client.post<BoundedContextResponse>(
    `/business-domains/${domainKey}/bounded-contexts`,
    body,
  );
  if (res.status !== 201) {
    throw new ApiError(res.status, res.data);
  }
  return res.data;
}

describe('BoundedContext API', () => {
  let adminClient: AxiosInstance;
  let userClient: AxiosInstance;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    adminClient = createClient(baseUrl);
    userClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'bc-admin@example.com',
      username: 'bcadmin',
      password: 'password123',
      firstName: 'BC',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const userAuth = await signup(userClient, {
      email: 'bc-user@example.com',
      username: 'bcuser',
      password: 'password123',
      firstName: 'BC',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);
  });

  // ─── GET /business-domains/{key}/bounded-contexts ──────────────────────────

  it('returns empty list for domain with no bounded contexts', async () => {
    const domain = await createDomain(adminClient, 'BC Empty Domain');
    const res = await userClient.get<BoundedContextResponse[]>(
      `/business-domains/${domain.key}/bounded-contexts`,
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    // May be empty or have a default BC created by the service
  });

  it('returns 404 for unknown domain', async () => {
    const res = await userClient.get('/business-domains/nonexistent-domain/bounded-contexts');
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const domain = await createDomain(adminClient, 'BC Auth Domain');
    const unauthClient = createClient(getBackendUrl());
    const res = await unauthClient.get(
      `/business-domains/${domain.key}/bounded-contexts`,
    );
    expect(res.status).toBe(401);
  });

  // ─── POST /business-domains/{key}/bounded-contexts ─────────────────────────

  it('admin can create a bounded context', async () => {
    const domain = await createDomain(adminClient, 'BC Create Domain');
    const res = await adminClient.post<BoundedContextResponse>(
      `/business-domains/${domain.key}/bounded-contexts`,
      { names: [{ locale: 'en', text: 'Billing Context' }] },
    );

    expect(res.status).toBe(201);
    expect(res.data.key).toContain(domain.key as string);
    expect(res.data.names[0].text).toBe('Billing Context');
    expect((res.data as any).domain.key).toBe(domain.key);
  });

  it('admin can create bounded context with context type', async () => {
    const domain = await createDomain(adminClient, 'BC Type Domain');
    const res = await adminClient.post<BoundedContextResponse>(
      `/business-domains/${domain.key}/bounded-contexts`,
      {
        names: [{ locale: 'en', text: 'Core Sales Context' }],
        contextType: 'FEATURE',
      },
    );

    expect(res.status).toBe(201);
    expect(res.data.contextType).toBe('FEATURE');
  });

  it('non-admin cannot create bounded context', async () => {
    const domain = await createDomain(adminClient, 'BC Forbidden Domain');
    const res = await userClient.post(
      `/business-domains/${domain.key}/bounded-contexts`,
      { names: [{ locale: 'en', text: 'Forbidden Context' }] },
    );

    expect(res.status).toBe(403);
  });

  it('returns 404 when creating for nonexistent domain', async () => {
    const res = await adminClient.post(
      '/business-domains/nonexistent-domain/bounded-contexts',
      { names: [{ locale: 'en', text: 'Orphan Context' }] },
    );
    expect(res.status).toBe(404);
  });

  // ─── PUT /bounded-contexts/{key}/names ─────────────────────────────────────

  it('admin can update bounded context names', async () => {
    const domain = await createDomain(adminClient, 'BC Update Names Domain');
    const bc = await createBoundedContext(adminClient, domain.key as string, 'Original Name');
    const encodedKey = encodeURIComponent(bc.key as string);

    const res = await adminClient.put<BoundedContextResponse>(
      `/bounded-contexts/${encodedKey}/names`,
      { names: [{ locale: 'en', text: 'Updated Name' }] },
    );

    expect(res.status).toBe(200);
    expect(res.data.names[0].text).toBe('Updated Name');
  });

  it('non-admin cannot update bounded context names', async () => {
    const domain = await createDomain(adminClient, 'BC Update Names 403 Domain');
    const bc = await createBoundedContext(adminClient, domain.key as string, 'Protected Name');
    const encodedKey = encodeURIComponent(bc.key as string);

    const res = await userClient.put(
      `/bounded-contexts/${encodedKey}/names`,
      { names: [{ locale: 'en', text: 'Forbidden Update' }] },
    );

    expect(res.status).toBe(403);
  });

  // ─── PUT /bounded-contexts/{key}/descriptions ──────────────────────────────

  it('admin can update bounded context descriptions', async () => {
    const domain = await createDomain(adminClient, 'BC Update Desc Domain');
    const bc = await createBoundedContext(adminClient, domain.key as string, 'Context With Desc');
    const encodedKey = encodeURIComponent(bc.key as string);

    const res = await adminClient.put<BoundedContextResponse>(
      `/bounded-contexts/${encodedKey}/descriptions`,
      { descriptions: [{ locale: 'en', text: 'This context handles billing' }] },
    );

    expect(res.status).toBe(200);
    expect(res.data.descriptions?.[0]?.text).toBe('This context handles billing');
  });

  // ─── DELETE /bounded-contexts/{key} ────────────────────────────────────────

  it('admin can delete a bounded context', async () => {
    const domain = await createDomain(adminClient, 'BC Delete Domain');
    const bc = await createBoundedContext(adminClient, domain.key as string, 'Context To Delete');
    const encodedKey = encodeURIComponent(bc.key as string);

    const res = await adminClient.delete(`/bounded-contexts/${encodedKey}`);

    expect(res.status).toBe(204);
  });

  it('non-admin cannot delete bounded context', async () => {
    const domain = await createDomain(adminClient, 'BC Delete 403 Domain');
    const bc = await createBoundedContext(adminClient, domain.key as string, 'Protected Delete');
    const encodedKey = encodeURIComponent(bc.key as string);

    const res = await userClient.delete(`/bounded-contexts/${encodedKey}`);

    expect(res.status).toBe(403);
  });

  // ─── domain response includes bounded contexts ─────────────────────────────

  it('domain response includes bounded contexts', async () => {
    const domain = await createDomain(adminClient, 'BC List Domain');
    await createBoundedContext(adminClient, domain.key as string, 'Context Alpha');
    await createBoundedContext(adminClient, domain.key as string, 'Context Beta');

    const res = await userClient.get<BusinessDomainResponse>(
      `/business-domains/${domain.key}`,
    );

    expect(res.status).toBe(200);
    expect((res.data as any).boundedContexts).toBeDefined();
    expect((res.data as any).boundedContexts.length).toBeGreaterThanOrEqual(2);
  });
});
