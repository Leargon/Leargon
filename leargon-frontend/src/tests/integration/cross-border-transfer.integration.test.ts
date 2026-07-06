import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, signup, signupCreator, signupAdmin, withToken, createProcess } from './testClient';
import type { AxiosInstance } from 'axios';
import type { ProcessResponse } from '@/api/generated/model/processResponse';
import type { LocalizedText } from '@/api/generated/model/localizedText';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

const noteText = (d?: LocalizedText[] | null, locale = 'en'): string | undefined =>
  d?.find((x) => x.locale === locale)?.text;

describe('Cross-Border Transfer API', () => {
  let ownerClient: AxiosInstance;
  let otherClient: AxiosInstance;
  let adminClient: AxiosInstance;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    ownerClient = createClient(baseUrl);
    otherClient = createClient(baseUrl);
    adminClient = createClient(baseUrl);

    const ownerAuth = await signupCreator(ownerClient, {
      email: 'cbt-owner@example.com',
      username: 'cbtowner',
      password: 'password123',
      firstName: 'CBT',
      lastName: 'Owner',
    });
    withToken(ownerClient, ownerAuth.accessToken);

    const otherAuth = await signup(otherClient, {
      email: 'cbt-other@example.com',
      username: 'cbtother',
      password: 'password123',
      firstName: 'CBT',
      lastName: 'Other',
    });
    withToken(otherClient, otherAuth.accessToken);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'cbt-admin@example.com',
      username: 'cbtadmin',
      password: 'password123',
      firstName: 'CBT',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);
  });

  it('owner can set and read back cross-border transfers', async () => {
    const process = await createProcess(ownerClient, 'CBT Set Process');

    const res = await ownerClient.put<ProcessResponse>(`/processes/${process.key}/cross-border-transfers`, {
      transfers: [
        { destinationCountry: 'JP', safeguard: 'BINDING_CORPORATE_RULES', notes: [] },
        { destinationCountry: 'US', safeguard: 'STANDARD_CONTRACTUAL_CLAUSES', notes: [{ locale: 'en', text: 'SCCs signed 2026' }] },
      ],
    });

    expect(res.status).toBe(200);
    const transfers = res.data.crossBorderTransfers ?? [];
    expect(transfers).toHaveLength(2);
    expect(transfers.find((t) => t.destinationCountry === 'JP')?.safeguard).toBe('BINDING_CORPORATE_RULES');
    expect(noteText(transfers.find((t) => t.destinationCountry === 'US')?.notes)).toBe('SCCs signed 2026');
  });

  it('admin can set cross-border transfers on any process', async () => {
    const process = await createProcess(ownerClient, 'CBT Admin Process');
    const res = await adminClient.put<ProcessResponse>(`/processes/${process.key}/cross-border-transfers`, {
      transfers: [{ destinationCountry: 'CH', safeguard: 'ADEQUACY_DECISION', notes: [] }],
    });
    expect(res.status).toBe(200);
    expect(res.data.crossBorderTransfers?.[0]?.destinationCountry).toBe('CH');
  });

  it('replacing transfers overwrites the previous set', async () => {
    const process = await createProcess(ownerClient, 'CBT Replace Process');
    await ownerClient.put(`/processes/${process.key}/cross-border-transfers`, {
      transfers: [{ destinationCountry: 'JP', safeguard: 'BINDING_CORPORATE_RULES', notes: [] }],
    });

    const res = await ownerClient.put<ProcessResponse>(`/processes/${process.key}/cross-border-transfers`, {
      transfers: [{ destinationCountry: 'US', safeguard: 'STANDARD_CONTRACTUAL_CLAUSES', notes: [] }],
    });
    const transfers = res.data.crossBorderTransfers ?? [];
    expect(transfers).toHaveLength(1);
    expect(transfers[0].destinationCountry).toBe('US');
  });

  it('non-owner cannot set cross-border transfers', async () => {
    const process = await createProcess(ownerClient, 'CBT Forbidden Process');
    const res = await otherClient.put(`/processes/${process.key}/cross-border-transfers`, {
      transfers: [{ destinationCountry: 'JP', safeguard: 'BINDING_CORPORATE_RULES', notes: [] }],
    });
    expect(res.status).toBe(403);
  });

  it('unauthenticated request is rejected', async () => {
    const process = await createProcess(ownerClient, 'CBT Unauth Process');
    const anon = createClient(getBackendUrl());
    const res = await anon.put(`/processes/${process.key}/cross-border-transfers`, {
      transfers: [{ destinationCountry: 'JP', safeguard: 'BINDING_CORPORATE_RULES', notes: [] }],
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown process', async () => {
    const res = await ownerClient.put('/processes/non-existent-process/cross-border-transfers', {
      transfers: [{ destinationCountry: 'JP', safeguard: 'BINDING_CORPORATE_RULES', notes: [] }],
    });
    expect(res.status).toBe(404);
  });

  // ─── Multilingual round-trip on notes ───────────────────────────────────────

  it('stores transfer notes in multiple locales, reads both back, and replaces on update', async () => {
    const process = await createProcess(ownerClient, 'CBT Multilingual Process');

    const created = await ownerClient.put<ProcessResponse>(`/processes/${process.key}/cross-border-transfers`, {
      transfers: [
        {
          destinationCountry: 'US',
          safeguard: 'EXCEPTION',
          notes: [
            { locale: 'en', text: 'Explicit consent obtained' },
            { locale: 'de', text: 'Ausdrückliche Einwilligung eingeholt' },
          ],
        },
      ],
    });
    const createdNotes = created.data.crossBorderTransfers?.[0]?.notes;
    expect(noteText(createdNotes, 'en')).toBe('Explicit consent obtained');
    expect(noteText(createdNotes, 'de')).toBe('Ausdrückliche Einwilligung eingeholt');

    // Read back both locales
    const get = await ownerClient.get<ProcessResponse>(`/processes/${process.key}`);
    const readNotes = get.data.crossBorderTransfers?.[0]?.notes;
    expect(noteText(readNotes, 'de')).toBe('Ausdrückliche Einwilligung eingeholt');

    // Update replaces the notes set (en-only) — de must be gone
    const updated = await ownerClient.put<ProcessResponse>(`/processes/${process.key}/cross-border-transfers`, {
      transfers: [
        { destinationCountry: 'US', safeguard: 'EXCEPTION', notes: [{ locale: 'en', text: 'Consent re-confirmed' }] },
      ],
    });
    const updatedNotes = updated.data.crossBorderTransfers?.[0]?.notes;
    expect(noteText(updatedNotes, 'en')).toBe('Consent re-confirmed');
    expect(noteText(updatedNotes, 'de')).toBeUndefined();
  });
});
