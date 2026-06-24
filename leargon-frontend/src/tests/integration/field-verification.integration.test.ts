import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, signup, withToken, createEntity } from './testClient';
import type { AxiosInstance } from 'axios';
import type { BusinessEntityResponse } from '@/api/generated/model/businessEntityResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Field Verification', () => {
  let owner: AxiosInstance;
  let other: AxiosInstance;

  beforeAll(async () => {
    owner = createClient(getBackendUrl());
    const ownerAuth = await signup(owner, {
      email: 'fv-owner@example.com', username: 'fvowner', password: 'password123', firstName: 'F', lastName: 'V',
    });
    withToken(owner, ownerAuth.accessToken);

    other = createClient(getBackendUrl());
    const otherAuth = await signup(other, {
      email: 'fv-other@example.com', username: 'fvother', password: 'password123', firstName: 'O', lastName: 'T',
    });
    withToken(other, otherAuth.accessToken);
  });

  it('marks owner-created fields VERIFIED with who/when', async () => {
    const entity = await createEntity(owner, 'FV Customer');
    const nameEn = entity.fieldStatuses?.find((s) => s.fieldName === 'names.en');
    expect(nameEn?.status).toBe('VERIFIED');
    expect(nameEn?.updatedByUsername).toBe('fvowner');
    expect(nameEn?.updatedAt).toBeTruthy();
  });

  it('lets the owner set a field status', async () => {
    const entity = await createEntity(owner, 'FV Settable');
    const res = await owner.put<BusinessEntityResponse>(
      `/business-entities/${entity.key}/field-verifications`,
      { fieldName: 'names.en', status: 'UNVERIFIED' },
    );
    expect(res.status).toBe(200);
    expect(res.data.fieldStatuses?.find((s) => s.fieldName === 'names.en')?.status).toBe('UNVERIFIED');
  });

  it('forbids a non-owner from setting a field status (403)', async () => {
    const entity = await createEntity(owner, 'FV Guarded');
    const res = await other.put(
      `/business-entities/${entity.key}/field-verifications`,
      { fieldName: 'names.en', status: 'VERIFIED' },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(403);
  });
});
