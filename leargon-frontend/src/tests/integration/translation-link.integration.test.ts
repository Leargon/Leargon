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
import type { TranslationLinkResponse } from '@/api/generated/model/translationLinkResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('TranslationLink API', () => {
  let adminClient: AxiosInstance;
  let userClient: AxiosInstance;
  let otherClient: AxiosInstance;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    adminClient = createClient(baseUrl);
    userClient = createClient(baseUrl);
    otherClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'tl-admin@example.com',
      username: 'tladmin',
      password: 'password123',
      firstName: 'TL',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const userAuth = await signup(userClient, {
      email: 'tl-user@example.com',
      username: 'tluser',
      password: 'password123',
      firstName: 'TL',
      lastName: 'User',
    });
    withToken(userClient, userAuth.accessToken);

    const otherAuth = await signup(otherClient, {
      email: 'tl-other@example.com',
      username: 'tlother',
      password: 'password123',
      firstName: 'TL',
      lastName: 'Other',
    });
    withToken(otherClient, otherAuth.accessToken);
  });

  // ─── GET /business-entities/{key}/translation-links ────────────────────────

  it('returns empty list for entity with no translation links', async () => {
    const entity = await createEntity(userClient, 'TL Empty Entity');
    const res = await userClient.get<TranslationLinkResponse[]>(
      `/business-entities/${entity.key}/translation-links`,
    );

    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(0);
  });

  it('returns 404 for unknown entity', async () => {
    const res = await userClient.get('/business-entities/nonexistent-entity/translation-links');
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const entity = await createEntity(userClient, 'TL Unauth Entity');
    const unauthClient = createClient(getBackendUrl());
    const res = await unauthClient.get(
      `/business-entities/${entity.key}/translation-links`,
    );
    expect(res.status).toBe(401);
  });

  // ─── POST /translation-links ───────────────────────────────────────────────

  it('can create a translation link between two entities', async () => {
    const entity1 = await createEntity(userClient, 'TL Customer Entity');
    const entity2 = await createEntity(userClient, 'TL Kunde Entity');

    const res = await userClient.post<TranslationLinkResponse>('/translation-links', {
      firstEntityKey: entity1.key,
      secondEntityKey: entity2.key,
      semanticDifferenceNote: 'Customer in Sales BC includes billing; Kunde in Warehouse BC does not',
    });

    expect(res.status).toBe(201);
    expect(res.data.id).toBeDefined();
    expect(res.data.semanticDifferenceNote).toBe(
      'Customer in Sales BC includes billing; Kunde in Warehouse BC does not',
    );
    expect((res.data as any).linkedEntity).toBeDefined();
  });

  it('can create a translation link without semantic note', async () => {
    const entity1 = await createEntity(userClient, 'TL No Note Entity A');
    const entity2 = await createEntity(userClient, 'TL No Note Entity B');

    const res = await userClient.post<TranslationLinkResponse>('/translation-links', {
      firstEntityKey: entity1.key,
      secondEntityKey: entity2.key,
    });

    expect(res.status).toBe(201);
    expect(res.data.semanticDifferenceNote ?? null).toBeNull();
  });

  it('returns 404 for unknown first entity', async () => {
    const entity2 = await createEntity(userClient, 'TL Real Entity');
    const res = await userClient.post('/translation-links', {
      firstEntityKey: 'nonexistent-entity',
      secondEntityKey: entity2.key,
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown second entity', async () => {
    const entity1 = await createEntity(userClient, 'TL Real Entity 2');
    const res = await userClient.post('/translation-links', {
      firstEntityKey: entity1.key,
      secondEntityKey: 'nonexistent-entity',
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 for duplicate translation link', async () => {
    const entity1 = await createEntity(userClient, 'TL Dup Entity A');
    const entity2 = await createEntity(userClient, 'TL Dup Entity B');
    const body = { firstEntityKey: entity1.key, secondEntityKey: entity2.key };
    await userClient.post('/translation-links', body);

    const res = await userClient.post('/translation-links', body);
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const entity1 = await createEntity(userClient, 'TL Unauth Link A');
    const entity2 = await createEntity(userClient, 'TL Unauth Link B');
    const unauthClient = createClient(getBackendUrl());
    const res = await unauthClient.post('/translation-links', {
      firstEntityKey: entity1.key,
      secondEntityKey: entity2.key,
    });
    expect(res.status).toBe(401);
  });

  // ─── PUT /translation-links/{id} ───────────────────────────────────────────

  it('creator can update the semantic note', async () => {
    const entity1 = await createEntity(userClient, 'TL Update Note A');
    const entity2 = await createEntity(userClient, 'TL Update Note B');
    const created = await userClient.post<TranslationLinkResponse>('/translation-links', {
      firstEntityKey: entity1.key,
      secondEntityKey: entity2.key,
      semanticDifferenceNote: 'Old note',
    });
    const linkId = created.data.id;

    const res = await userClient.put<TranslationLinkResponse>(`/translation-links/${linkId}`, {
      semanticDifferenceNote: 'New updated note',
    });

    expect(res.status).toBe(200);
    expect(res.data.semanticDifferenceNote).toBe('New updated note');
  });

  it('returns 403 when non-creator non-admin tries to update', async () => {
    const entity1 = await createEntity(userClient, 'TL 403 Update A');
    const entity2 = await createEntity(userClient, 'TL 403 Update B');
    const created = await userClient.post<TranslationLinkResponse>('/translation-links', {
      firstEntityKey: entity1.key,
      secondEntityKey: entity2.key,
    });
    const linkId = created.data.id;

    const res = await otherClient.put(`/translation-links/${linkId}`, {
      semanticDifferenceNote: 'Hostile update',
    });

    expect(res.status).toBe(403);
  });

  it('admin can update any translation link', async () => {
    const entity1 = await createEntity(userClient, 'TL Admin Update A');
    const entity2 = await createEntity(userClient, 'TL Admin Update B');
    const created = await userClient.post<TranslationLinkResponse>('/translation-links', {
      firstEntityKey: entity1.key,
      secondEntityKey: entity2.key,
      semanticDifferenceNote: 'User note',
    });
    const linkId = created.data.id;

    const res = await adminClient.put<TranslationLinkResponse>(`/translation-links/${linkId}`, {
      semanticDifferenceNote: 'Admin updated note',
    });

    expect(res.status).toBe(200);
    expect(res.data.semanticDifferenceNote).toBe('Admin updated note');
  });

  it('returns 404 for unknown translation link id', async () => {
    const res = await userClient.put('/translation-links/999999', {
      semanticDifferenceNote: 'No such link',
    });
    expect(res.status).toBe(404);
  });

  // ─── DELETE /translation-links/{id} ────────────────────────────────────────

  it('creator can delete their translation link', async () => {
    const entity1 = await createEntity(userClient, 'TL Delete A');
    const entity2 = await createEntity(userClient, 'TL Delete B');
    const created = await userClient.post<TranslationLinkResponse>('/translation-links', {
      firstEntityKey: entity1.key,
      secondEntityKey: entity2.key,
    });
    const linkId = created.data.id;

    const res = await userClient.delete(`/translation-links/${linkId}`);
    expect(res.status).toBe(204);

    // Verify it's gone
    const listRes = await userClient.get(
      `/business-entities/${entity1.key}/translation-links`,
    );
    expect(listRes.data).toHaveLength(0);
  });

  it('returns 403 when non-creator non-admin tries to delete', async () => {
    const entity1 = await createEntity(userClient, 'TL 403 Delete A');
    const entity2 = await createEntity(userClient, 'TL 403 Delete B');
    const created = await userClient.post<TranslationLinkResponse>('/translation-links', {
      firstEntityKey: entity1.key,
      secondEntityKey: entity2.key,
    });
    const linkId = created.data.id;

    const res = await otherClient.delete(`/translation-links/${linkId}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown translation link id on delete', async () => {
    const res = await userClient.delete('/translation-links/999999');
    expect(res.status).toBe(404);
  });

  // ─── bilateral visibility ───────────────────────────────────────────────────

  it('translation link is visible from both entity perspectives', async () => {
    const entity1 = await createEntity(userClient, 'TL Bilateral X');
    const entity2 = await createEntity(userClient, 'TL Bilateral Y');
    await userClient.post('/translation-links', {
      firstEntityKey: entity1.key,
      secondEntityKey: entity2.key,
      semanticDifferenceNote: 'Bilateral check',
    });

    const fromFirst = await userClient.get(
      `/business-entities/${entity1.key}/translation-links`,
    );
    const fromSecond = await userClient.get(
      `/business-entities/${entity2.key}/translation-links`,
    );

    expect(fromFirst.data).toHaveLength(1);
    expect((fromFirst.data[0] as any).linkedEntity.key).toBe(entity2.key);

    expect(fromSecond.data).toHaveLength(1);
    expect((fromSecond.data[0] as any).linkedEntity.key).toBe(entity1.key);
  });
});
