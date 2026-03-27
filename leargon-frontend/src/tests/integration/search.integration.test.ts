import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createEntity,
  createDomain,
  createProcess,
  createOrgUnit,
} from './testClient';
import type { AxiosInstance } from 'axios';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Search API', () => {
  let userClient: AxiosInstance;
  let adminClient: AxiosInstance;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    userClient = createClient(baseUrl);
    adminClient = createClient(baseUrl);

    const userAuth = await signup(userClient, {
      email: 'search-user@example.com',
      username: 'searchuser',
      password: 'password123',
      firstName: 'Search',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'search-admin@example.com',
      username: 'searchadmin',
      password: 'password123',
      firstName: 'Search',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);
  });

  // ─── Auth guard ────────────────────────────────────────────────────────────

  it('returns 401 without authentication', async () => {
    const client = createClient(getBackendUrl());
    const res = await client.get('/search?q=test');
    expect(res.status).toBe(401);
  });

  // ─── Input validation ──────────────────────────────────────────────────────

  it('returns 400 when query is shorter than 2 characters', async () => {
    const res = await userClient.get('/search?q=a');
    expect(res.status).toBe(400);
  });

  // ─── Entity search ─────────────────────────────────────────────────────────

  it('finds a business entity by name', async () => {
    await createEntity(userClient, 'SearchIntTestEntityXYZ');

    const res = await userClient.get('/search?q=SearchIntTestEntityXYZ');
    expect(res.status).toBe(200);
    expect(res.data.query).toBe('SearchIntTestEntityXYZ');
    expect(res.data.totalCount).toBeGreaterThanOrEqual(1);

    const result = (res.data.results as Array<{ type: string; matchedIn: string }>).find(
      (r) => r.type === 'BUSINESS_ENTITY',
    );
    expect(result).toBeDefined();
    expect(result!.matchedIn).toBe('NAME');
  });

  it('finds a business entity by description', async () => {
    const res1 = await userClient.post('/business-entities', {
      names: [{ locale: 'en', text: 'IntUnrelatedEntityName' }],
      descriptions: [{ locale: 'en', text: 'IntDescriptionContainsSearchTermZZZ' }],
    });
    expect(res1.status).toBe(201);

    const res = await userClient.get('/search?q=SearchTermZZZ');
    expect(res.status).toBe(200);

    const result = (res.data.results as Array<{ type: string; matchedIn: string }>).find(
      (r) => r.type === 'BUSINESS_ENTITY',
    );
    expect(result).toBeDefined();
    expect(result!.matchedIn).toBe('DESCRIPTION');
  });

  // ─── Domain search ─────────────────────────────────────────────────────────

  it('finds a business domain by name', async () => {
    await createDomain(adminClient, 'SearchIntDomainABC');

    const res = await adminClient.get('/search?q=SearchIntDomainABC');
    expect(res.status).toBe(200);

    const result = (res.data.results as Array<{ type: string; matchedIn: string }>).find(
      (r) => r.type === 'BUSINESS_DOMAIN',
    );
    expect(result).toBeDefined();
    expect(result!.matchedIn).toBe('NAME');
  });

  // ─── Process search ────────────────────────────────────────────────────────

  it('finds a business process by name', async () => {
    await createProcess(userClient, 'SearchIntProcessQQQ');

    const res = await userClient.get('/search?q=SearchIntProcessQQQ');
    expect(res.status).toBe(200);

    const result = (res.data.results as Array<{ type: string; matchedIn: string }>).find(
      (r) => r.type === 'BUSINESS_PROCESS',
    );
    expect(result).toBeDefined();
    expect(result!.matchedIn).toBe('NAME');
  });

  // ─── Org unit search ───────────────────────────────────────────────────────

  it('finds an organisational unit by name', async () => {
    await createOrgUnit(adminClient, 'SearchIntOrgUnitMMM');

    const res = await adminClient.get('/search?q=SearchIntOrgUnitMMM');
    expect(res.status).toBe(200);

    const result = (res.data.results as Array<{ type: string; matchedIn: string }>).find(
      (r) => r.type === 'ORGANISATIONAL_UNIT',
    );
    expect(result).toBeDefined();
    expect(result!.matchedIn).toBe('NAME');
  });

  // ─── Type filtering ────────────────────────────────────────────────────────

  it('with types filter returns only matching type', async () => {
    await createEntity(userClient, 'FilterIntTarget Entity');
    await createDomain(adminClient, 'FilterIntTarget Domain');

    const res = await userClient.get('/search?q=FilterIntTarget&types=BUSINESS_ENTITY');
    expect(res.status).toBe(200);

    const results = res.data.results as Array<{ type: string }>;
    expect(results.every((r) => r.type === 'BUSINESS_ENTITY')).toBe(true);
    expect(results.every((r) => r.type !== 'BUSINESS_DOMAIN')).toBe(true);
  });

  it('with multiple types filter returns only those types', async () => {
    await createEntity(userClient, 'MultiIntTypeTarget Entity');
    await createProcess(userClient, 'MultiIntTypeTarget Process');
    await createDomain(adminClient, 'MultiIntTypeTarget Domain');

    const res = await userClient.get(
      '/search?q=MultiIntTypeTarget&types=BUSINESS_ENTITY&types=BUSINESS_PROCESS',
    );
    expect(res.status).toBe(200);

    const results = res.data.results as Array<{ type: string }>;
    expect(results.every((r) => ['BUSINESS_ENTITY', 'BUSINESS_PROCESS'].includes(r.type))).toBe(true);
    expect(results.every((r) => r.type !== 'BUSINESS_DOMAIN')).toBe(true);
  });

  // ─── Result ordering ───────────────────────────────────────────────────────

  it('returns name matches before description matches', async () => {
    await userClient.post('/business-entities', {
      names: [{ locale: 'en', text: 'IntUnrelatedName' }],
      descriptions: [{ locale: 'en', text: 'IntDescContainsOrderTerm' }],
    });
    await createEntity(userClient, 'IntOrderTermInName');

    const res = await userClient.get('/search?q=IntOrderTerm');
    expect(res.status).toBe(200);

    const results = (res.data.results as Array<{ type: string; matchedIn: string }>).filter(
      (r) => r.type === 'BUSINESS_ENTITY',
    );
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].matchedIn).toBe('NAME');
  });

  // ─── Limit ─────────────────────────────────────────────────────────────────

  it('respects limit parameter', async () => {
    for (let i = 1; i <= 5; i++) {
      await createEntity(userClient, `IntLimitableEntity${i}`);
    }

    const res = await userClient.get('/search?q=IntLimitableEntity&limit=3');
    expect(res.status).toBe(200);
    expect((res.data.results as unknown[]).length).toBe(3);
    expect(res.data.totalCount).toBeGreaterThanOrEqual(5);
  });

  // ─── No match ──────────────────────────────────────────────────────────────

  it('returns empty results when nothing matches', async () => {
    const res = await userClient.get('/search?q=completelyNonExistentTermIntTest9999');
    expect(res.status).toBe(200);
    expect(res.data.totalCount).toBe(0);
    const results = res.data.results;
    expect(results === null || results === undefined || (results as unknown[]).length === 0).toBe(true);
  });

  // ─── Response shape ────────────────────────────────────────────────────────

  it('response includes query, totalCount and results fields', async () => {
    const res = await userClient.get('/search?q=IntShape');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('query');
    expect(res.data).toHaveProperty('totalCount');
    expect(res.data.query).toBe('IntShape');
  });
});
