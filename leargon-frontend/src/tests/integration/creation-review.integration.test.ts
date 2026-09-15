import { describe, it, expect, beforeAll } from 'vitest';
import type { AxiosInstance } from 'axios';
import { createClient, signup, signupAdmin, withToken, createDomain } from './testClient';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

const names = (text: string) => [{ locale: 'en', text }];

interface TaskBody {
  ruleCode: string;
  resourceKey: string;
  acknowledgeable?: boolean;
  creationReview?: {
    recordId: number;
    createdBy?: { username: string };
    basis?: string;
    duplicateJustification?: Array<{ locale: string; text: string }>;
  };
}

/**
 * Awareness: the owner of the container an item was created in gets a "review new item" to-do when
 * someone else created it there, closed by acknowledging (only the owner or an admin may).
 */
describe('Creation review to-do', () => {
  let admin: AxiosInstance;
  let domainOwner: AxiosInstance;
  let bcOwner: AxiosInstance;
  let stranger: AxiosInstance;
  let billing: string;

  const client = async (email: string, username: string): Promise<AxiosInstance> => {
    const c = createClient(getBackendUrl());
    const auth = await signup(c, { email, username, password: 'password123', firstName: 'CR', lastName: username });
    return withToken(c, auth.accessToken);
  };

  const reviewFor = async (c: AxiosInstance, key: string): Promise<TaskBody | undefined> =>
    ((await c.get('/tasks')).data.tasks as TaskBody[]).find((t) => t.resourceKey === key && t.ruleCode === 'REVIEW_REALM_CREATION');

  beforeAll(async () => {
    admin = createClient(getBackendUrl());
    const auth = await signupAdmin(admin, {
      email: 'cr-admin@example.com', username: 'cradmin', password: 'password123', firstName: 'CR', lastName: 'Admin',
    });
    withToken(admin, auth.accessToken);
    domainOwner = await client('cr-domain@example.com', 'crdomain');
    bcOwner = await client('cr-bc@example.com', 'crbc');
    stranger = await client('cr-stranger@example.com', 'crstranger');

    const domain = (await createDomain(admin, 'CR Sales', { ownerUsername: 'crdomain' })).key;
    billing = (await admin.post(`/business-domains/${domain}/bounded-contexts`, { names: names('CR Billing'), ownerUsername: 'crbc' })).data.key;
  });

  it('raises a review for the context owner when the domain owner creates in their context', async () => {
    const created = await domainOwner.post('/business-entities', { names: names('CR Invoice'), boundedContextKey: billing });
    expect(created.status).toBe(201);

    const review = await reviewFor(bcOwner, created.data.key);
    expect(review?.acknowledgeable).toBe(true);
    expect(review?.creationReview?.createdBy?.username).toBe('crdomain');
    expect(review?.creationReview?.basis).toBe('DOMAIN_OWNER');

    // The creator gets no review of their own creation.
    expect(await reviewFor(domainOwner, created.data.key)).toBeUndefined();
  });

  it('raises no review when the context owner creates in their own context', async () => {
    const created = await bcOwner.post('/business-entities', { names: names('CR Credit Note'), boundedContextKey: billing });
    expect(await reviewFor(bcOwner, created.data.key)).toBeUndefined();
  });

  it('only the owner may acknowledge; the acknowledgement survives later edits', async () => {
    const created = await domainOwner.post('/business-entities', { names: names('CR Receipt'), boundedContextKey: billing });
    const review = await reviewFor(bcOwner, created.data.key);
    const recordId = review!.creationReview!.recordId;

    expect((await stranger.post(`/creation/reviews/${recordId}/acknowledge`)).status).toBe(403);
    expect((await bcOwner.post(`/creation/reviews/${recordId}/acknowledge`)).status).toBe(204);
    expect(await reviewFor(bcOwner, created.data.key)).toBeUndefined();

    await admin.put(`/business-entities/${created.data.key}/descriptions`, [{ locale: 'en', text: 'Edited later' }]);
    expect(await reviewFor(bcOwner, created.data.key)).toBeUndefined();
  });

  it('carries a multilingual duplicate justification to the reviewer', async () => {
    const first = await domainOwner.post('/business-entities', { names: names('CR Customer'), boundedContextKey: billing });
    const justified = await domainOwner.post('/business-entities', {
      names: names('CR Customer'),
      boundedContextKey: billing,
      acknowledgedDuplicateKeys: [first.data.key],
      duplicateJustification: [
        { locale: 'en', text: 'A separate customer concept for invoicing' },
        { locale: 'de', text: 'Ein eigenes Kundenkonzept für die Rechnungsstellung' },
      ],
    });
    expect(justified.status).toBe(201);

    const review = await reviewFor(bcOwner, justified.data.key);
    const byLocale = Object.fromEntries((review?.creationReview?.duplicateJustification ?? []).map((j) => [j.locale, j.text]));
    expect(byLocale).toEqual({
      en: 'A separate customer concept for invoicing',
      de: 'Ein eigenes Kundenkonzept für die Rechnungsstellung',
    });
  });
});
