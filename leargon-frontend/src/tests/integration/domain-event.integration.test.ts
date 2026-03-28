import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createDomain,
  createProcess,
  ApiError,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { DomainEventResponse } from '@/api/generated/model/domainEventResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

async function createBoundedContext(
  client: AxiosInstance,
  domainKey: string,
  name: string,
): Promise<{ key: string }> {
  const res = await client.post(`/business-domains/${domainKey}/bounded-contexts`, {
    names: [{ locale: 'en', text: name }],
  });
  if (res.status !== 201) {
    throw new ApiError(res.status, res.data);
  }
  return res.data;
}

async function createDomainEvent(
  client: AxiosInstance,
  publishingBoundedContextKey: string,
  name: string,
): Promise<DomainEventResponse> {
  const res = await client.post<DomainEventResponse>('/domain-events', {
    publishingBoundedContextKey,
    names: [{ locale: 'en', text: name }],
  });
  if (res.status !== 201) {
    throw new ApiError(res.status, res.data);
  }
  return res.data;
}

describe('DomainEvent API', () => {
  let adminClient: AxiosInstance;
  let userClient: AxiosInstance;
  let domainKey: string;
  let bcKey: string;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    adminClient = createClient(baseUrl);
    userClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'de-admin@example.com',
      username: 'deadmin',
      password: 'password123',
      firstName: 'DE',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const userAuth = await signup(userClient, {
      email: 'de-user@example.com',
      username: 'deuser',
      password: 'password123',
      firstName: 'DE',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);

    // Set up shared domain and bounded context
    const domain = await createDomain(adminClient, 'DE Test Domain');
    domainKey = domain.key as string;
    const bc = await createBoundedContext(adminClient, domainKey, 'DE Test BC');
    bcKey = bc.key;
  });

  // ─── GET /domain-events ────────────────────────────────────────────────────

  it('returns list of domain events', async () => {
    const res = await userClient.get<DomainEventResponse[]>('/domain-events');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const unauthClient = createClient(getBackendUrl());
    const res = await unauthClient.get('/domain-events');
    expect(res.status).toBe(401);
  });

  // ─── POST /domain-events ───────────────────────────────────────────────────

  it('authenticated user can create a domain event', async () => {
    const res = await userClient.post<DomainEventResponse>('/domain-events', {
      publishingBoundedContextKey: bcKey,
      names: [{ locale: 'en', text: 'Order Placed' }],
    });

    expect(res.status).toBe(201);
    expect(res.data.key).toContain(bcKey);
    expect(res.data.names[0].text).toBe('Order Placed');
    expect(res.data.publishingBoundedContext.key).toBe(bcKey);
    expect(res.data.publishingBoundedContext.domainKey).toBe(domainKey);
  });

  it('can create domain event with descriptions', async () => {
    const res = await userClient.post<DomainEventResponse>('/domain-events', {
      publishingBoundedContextKey: bcKey,
      names: [{ locale: 'en', text: 'Payment Received' }],
      descriptions: [{ locale: 'en', text: 'Fired when payment is confirmed' }],
    });

    expect(res.status).toBe(201);
    expect(res.data.descriptions[0].text).toBe('Fired when payment is confirmed');
  });

  it('returns 404 for unknown bounded context', async () => {
    const res = await userClient.post('/domain-events', {
      publishingBoundedContextKey: 'nonexistent/bc',
      names: [{ locale: 'en', text: 'Orphan Event' }],
    });
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const unauthClient = createClient(getBackendUrl());
    const res = await unauthClient.post('/domain-events', {
      publishingBoundedContextKey: bcKey,
      names: [{ locale: 'en', text: 'Unauth Event' }],
    });
    expect(res.status).toBe(401);
  });

  // ─── GET /domain-events/{key} ──────────────────────────────────────────────

  it('can get domain event by key', async () => {
    const created = await createDomainEvent(userClient, bcKey, 'Product Launched');
    const encodedKey = encodeURIComponent(created.key);

    const res = await userClient.get<DomainEventResponse>(`/domain-events/${encodedKey}`);

    expect(res.status).toBe(200);
    expect(res.data.key).toBe(created.key);
    expect(res.data.names[0].text).toBe('Product Launched');
  });

  it('returns 404 for unknown event key', async () => {
    const res = await userClient.get('/domain-events/nonexistent-event');
    expect(res.status).toBe(404);
  });

  // ─── PUT /domain-events/{key}/names ────────────────────────────────────────

  it('authenticated user can update event names', async () => {
    const created = await createDomainEvent(userClient, bcKey, 'Original Event');
    const encodedKey = encodeURIComponent(created.key);

    const res = await userClient.put<DomainEventResponse>(`/domain-events/${encodedKey}/names`, [
      { locale: 'en', text: 'Renamed Event' },
    ]);

    expect(res.status).toBe(200);
    expect(res.data.names[0].text).toBe('Renamed Event');
  });

  // ─── PUT /domain-events/{key}/descriptions ─────────────────────────────────

  it('authenticated user can update event descriptions', async () => {
    const created = await createDomainEvent(userClient, bcKey, 'Event For Desc Update');
    const encodedKey = encodeURIComponent(created.key);

    const res = await userClient.put<DomainEventResponse>(
      `/domain-events/${encodedKey}/descriptions`,
      [{ locale: 'en', text: 'Updated description' }],
    );

    expect(res.status).toBe(200);
    expect(res.data.descriptions[0].text).toBe('Updated description');
  });

  // ─── PUT /domain-events/{key}/consumers ────────────────────────────────────

  it('admin can set consumers on a domain event', async () => {
    const consumerDomain = await createDomain(adminClient, 'DE Consumer Domain');
    const consumerBc = await createBoundedContext(adminClient, consumerDomain.key as string, 'Consumer BC');
    const created = await createDomainEvent(userClient, bcKey, 'Event With Consumers');
    const encodedKey = encodeURIComponent(created.key);

    const res = await adminClient.put<DomainEventResponse>(
      `/domain-events/${encodedKey}/consumers`,
      { consumerBoundedContextKeys: [consumerBc.key] },
    );

    expect(res.status).toBe(200);
    expect(res.data.consumers).toHaveLength(1);
    expect(res.data.consumers[0].key).toBe(consumerBc.key);
  });

  it('returns 403 when non-admin tries to set consumers', async () => {
    const created = await createDomainEvent(userClient, bcKey, 'Event Consumer 403');
    const encodedKey = encodeURIComponent(created.key);

    const res = await userClient.put(`/domain-events/${encodedKey}/consumers`, {
      consumerBoundedContextKeys: [],
    });

    expect(res.status).toBe(403);
  });

  // ─── POST /domain-events/{key}/process-links ───────────────────────────────

  it('authenticated user can add a process link', async () => {
    const created = await createDomainEvent(userClient, bcKey, 'Event With Process Link');
    const encodedKey = encodeURIComponent(created.key);
    const process = await createProcess(userClient, 'Linked Process');

    const res = await userClient.post<DomainEventResponse>(
      `/domain-events/${encodedKey}/process-links`,
      { processKey: process.key, linkType: 'TRIGGERS' },
    );

    expect(res.status).toBe(200);
    expect(res.data.processLinks).toHaveLength(1);
    expect(res.data.processLinks[0].process.key).toBe(process.key);
    expect(res.data.processLinks[0].linkType).toBe('TRIGGERS');
  });

  it('returns 404 for unknown process in process link', async () => {
    const created = await createDomainEvent(userClient, bcKey, 'Event PLink 404');
    const encodedKey = encodeURIComponent(created.key);

    const res = await userClient.post(`/domain-events/${encodedKey}/process-links`, {
      processKey: 'nonexistent-process',
      linkType: 'TRIGGERS',
    });

    expect(res.status).toBe(404);
  });

  // ─── DELETE /domain-events/{key}/process-links/{linkId} ────────────────────

  it('can remove a process link from a domain event', async () => {
    const created = await createDomainEvent(userClient, bcKey, 'Event Del Process Link');
    const encodedKey = encodeURIComponent(created.key);
    const process = await createProcess(userClient, 'Process To Unlink');

    const addRes = await userClient.post<DomainEventResponse>(
      `/domain-events/${encodedKey}/process-links`,
      { processKey: process.key, linkType: 'HANDLES' },
    );
    const linkId = addRes.data.processLinks[0].id;

    const res = await userClient.delete<DomainEventResponse>(
      `/domain-events/${encodedKey}/process-links/${linkId}`,
    );

    expect(res.status).toBe(200);
    expect(res.data.processLinks?.length ?? 0).toBe(0);
  });

  // ─── DELETE /domain-events/{key} ───────────────────────────────────────────

  it('admin can delete a domain event', async () => {
    const created = await createDomainEvent(userClient, bcKey, 'Event To Delete');
    const encodedKey = encodeURIComponent(created.key);

    const res = await adminClient.delete(`/domain-events/${encodedKey}`);

    expect(res.status).toBe(204);
  });

  it('returns 403 when non-admin tries to delete', async () => {
    const created = await createDomainEvent(userClient, bcKey, 'Protected Event');
    const encodedKey = encodeURIComponent(created.key);

    const res = await userClient.delete(`/domain-events/${encodedKey}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown event key on delete', async () => {
    const res = await adminClient.delete('/domain-events/nonexistent-event');
    expect(res.status).toBe(404);
  });

  // ─── GET /domain-events includes BC info ───────────────────────────────────

  it('domain events list includes publishing bounded context info', async () => {
    await createDomainEvent(userClient, bcKey, 'List Event Check');

    const res = await userClient.get<DomainEventResponse[]>('/domain-events');

    expect(res.status).toBe(200);
    const eventsWithBc = res.data.filter((e) => e.publishingBoundedContext?.key === bcKey);
    expect(eventsWithBc.length).toBeGreaterThanOrEqual(1);
    expect(eventsWithBc[0].publishingBoundedContext.domainKey).toBe(domainKey);
  });
});
