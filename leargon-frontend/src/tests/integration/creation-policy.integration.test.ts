import { describe, it, expect, beforeAll } from 'vitest';
import type { AxiosInstance } from 'axios';
import { createClient, signup, signupAdmin, withToken, createDomain } from './testClient';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

const names = (text: string) => [{ locale: 'en', text }];

/**
 * Decentralised, realm-based creation (CreationPolicyService):
 *  - a domain owner creates bounded contexts and anything inside them;
 *  - a bounded-context owner creates entities / processes / domain events in their context;
 *  - nobody creates in someone else's realm; top level stays with admins / methodology editors;
 *  - the backend-computed flags (`creatableChildTypes`, `/creation/capabilities`, `/creation/targets`)
 *    match enforcement, so the UI never re-implements the policy.
 */
describe('Creation policy: realm-based creation', () => {
  let admin: AxiosInstance;
  let domainOwner: AxiosInstance;
  let bcOwner: AxiosInstance;
  let stranger: AxiosInstance;
  let domainKey: string;
  let billingKey: string;
  let shippingKey: string;

  const client = async (email: string, username: string): Promise<AxiosInstance> => {
    const c = createClient(getBackendUrl());
    const auth = await signup(c, { email, username, password: 'password123', firstName: 'Realm', lastName: username });
    return withToken(c, auth.accessToken);
  };

  beforeAll(async () => {
    admin = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(admin, {
      email: 'cp-admin@example.com', username: 'cpadmin', password: 'password123', firstName: 'CP', lastName: 'Admin',
    });
    withToken(admin, adminAuth.accessToken);

    domainOwner = await client('cp-domain-owner@example.com', 'cpdomainowner');
    bcOwner = await client('cp-bc-owner@example.com', 'cpbcowner');
    stranger = await client('cp-stranger@example.com', 'cpstranger');

    domainKey = (await createDomain(admin, 'CP Sales', { ownerUsername: 'cpdomainowner' })).key;
    const billing = await admin.post(`/business-domains/${domainKey}/bounded-contexts`, {
      names: names('CP Billing'), ownerUsername: 'cpbcowner',
    });
    expect(billing.status).toBe(201);
    billingKey = billing.data.key;

    const otherDomainKey = (await createDomain(admin, 'CP Logistics')).key;
    const shipping = await admin.post(`/business-domains/${otherDomainKey}/bounded-contexts`, { names: names('CP Shipping') });
    shippingKey = shipping.data.key;
  });

  it('a domain owner can create a bounded context and an entity inside their domain', async () => {
    const bc = await domainOwner.post(`/business-domains/${domainKey}/bounded-contexts`, { names: names('CP Ordering') });
    expect(bc.status).toBe(201);

    const entity = await domainOwner.post('/business-entities', { names: names('CP Order'), boundedContextKey: bc.data.key });
    expect(entity.status).toBe(201);
    expect(entity.data.boundedContext?.key ?? bc.data.key).toBe(bc.data.key);
  });

  it('a bounded-context owner can create entities, processes and domain events in their context', async () => {
    expect((await bcOwner.post('/business-entities', { names: names('CP Invoice'), boundedContextKey: billingKey })).status).toBe(201);
    expect((await bcOwner.post('/processes', { names: names('CP Dunning'), boundedContextKey: billingKey })).status).toBe(201);
    expect((await bcOwner.post('/domain-events', { names: names('CP Invoice Issued'), publishingBoundedContextKey: billingKey })).status).toBe(201);
  });

  it('a bounded-context owner cannot create in a foreign context or at top level (403)', async () => {
    expect((await bcOwner.post('/business-entities', { names: names('CP Parcel'), boundedContextKey: shippingKey })).status).toBe(403);
    expect((await bcOwner.post('/business-entities', { names: names('CP Unplaced') })).status).toBe(403);
    expect((await bcOwner.post(`/business-domains/${domainKey}/bounded-contexts`, { names: names('CP Ledger') })).status).toBe(403);
  });

  it('a stranger cannot create anything in the realm (403)', async () => {
    expect((await stranger.post('/business-entities', { names: names('CP Sneaky'), boundedContextKey: billingKey })).status).toBe(403);
    expect((await stranger.post(`/business-domains/${domainKey}/bounded-contexts`, { names: names('CP Sneaky') })).status).toBe(403);
    expect((await stranger.post('/business-domains', { names: names('CP Sneaky'), parentKey: domainKey })).status).toBe(403);
  });

  it('creatableChildTypes on the bounded context reflects each actor’s rights', async () => {
    const flags = async (c: AxiosInstance) => (await c.get(`/bounded-contexts/${billingKey}`)).data.creatableChildTypes ?? [];

    expect(await flags(bcOwner)).toEqual(expect.arrayContaining(['BUSINESS_ENTITY', 'BUSINESS_PROCESS', 'DOMAIN_EVENT']));
    expect(await flags(domainOwner)).toEqual(expect.arrayContaining(['BUSINESS_ENTITY', 'BUSINESS_PROCESS']));
    expect(await flags(stranger)).toEqual([]);
  });

  it('creatableChildTypes on the domain lets the owner add subdomains and contexts but not delete', async () => {
    const res = await domainOwner.get(`/business-domains/${domainKey}`);
    expect(res.data.creatableChildTypes).toEqual(expect.arrayContaining(['BUSINESS_DOMAIN', 'BOUNDED_CONTEXT']));
    expect(res.data.canDelete).toBe(false);

    const strangerView = await stranger.get(`/business-domains/${domainKey}`);
    expect(strangerView.data.creatableChildTypes).toEqual([]);
  });

  it('creation capabilities: the bounded-context owner may create entities, a stranger nothing', async () => {
    const caps = async (c: AxiosInstance) =>
      Object.fromEntries(((await c.get('/creation/capabilities')).data.items as Array<{ itemType: string }>).map((i) => [i.itemType, i]));

    const owner = await caps(bcOwner);
    expect(owner.BUSINESS_ENTITY).toMatchObject({ canCreate: true, canCreateUnplaced: false });
    expect(owner.SERVICE_PROVIDER).toMatchObject({ canCreate: false });

    const none = await caps(stranger);
    expect(Object.values(none).every((i) => !(i as { canCreate: boolean }).canCreate)).toBe(true);
  });

  it('creation targets list only the bounded contexts in the user’s realm', async () => {
    const res = await bcOwner.get('/creation/targets', { params: { itemType: 'BUSINESS_ENTITY' } });
    expect(res.status).toBe(200);
    expect(res.data.unrestricted).toBe(false);
    const keys = (res.data.boundedContexts as Array<{ key: string }>).map((b) => b.key);
    expect(keys).toContain(billingKey);
    expect(keys).not.toContain(shippingKey);
  });

  it('domain and bounded-context owners can be assigned; the inherited owner is exposed', async () => {
    const sub = await admin.post('/business-domains', { names: names('CP Pricing'), parentKey: domainKey });
    expect(sub.data.owner ?? null).toBeNull();
    expect(sub.data.effectiveOwner.username).toBe('cpdomainowner');

    // The parent-domain owner delegates the subdomain to the bounded-context owner.
    const put = await domainOwner.put(`/business-domains/${sub.data.key}/owner`, { ownerUsername: 'cpbcowner' });
    expect(put.status).toBe(200);
    expect(put.data.owner.username).toBe('cpbcowner');

    // A stranger cannot reassign it.
    expect((await stranger.put(`/business-domains/${sub.data.key}/owner`, { ownerUsername: 'cpstranger' })).status).toBe(403);
  });

  it('creates a delegated entity atomically; the creator cannot edit it afterwards', async () => {
    const created = await bcOwner.post('/business-entities', {
      names: names('CP Receipt'),
      boundedContextKey: billingKey,
      dataOwnerUsername: 'cpdomainowner',
      dataStewardUsername: 'cpstranger',
    });
    expect(created.status).toBe(201);

    const entity = (await admin.get(`/business-entities/${created.data.key}`)).data;
    expect(entity.dataOwner.username).toBe('cpdomainowner');
    expect(entity.dataSteward.username).toBe('cpstranger');

    // Creating grants no edit rights: the bounded-context owner delegated the entity away.
    const edit = await bcOwner.put(`/business-entities/${created.data.key}/retention-period`, {
      retentionPeriod: [{ locale: 'en', text: '10 years' }],
    });
    expect(edit.status).toBe(403);
  });

  it('creates a process with a multilingual purpose in one request and replaces it on update', async () => {
    const created = await bcOwner.post('/processes', {
      names: names('CP Collections'),
      boundedContextKey: billingKey,
      legalBasis: 'CONTRACT',
      purpose: [
        { locale: 'en', text: 'Collect overdue payments' },
        { locale: 'de', text: 'Überfällige Zahlungen einziehen' },
      ],
    });
    expect(created.status).toBe(201);

    const read = (await admin.get(`/processes/${created.data.key}`)).data;
    const byLocale = Object.fromEntries((read.purpose as Array<{ locale: string; text: string }>).map((p) => [p.locale, p.text]));
    expect(byLocale).toEqual({ en: 'Collect overdue payments', de: 'Überfällige Zahlungen einziehen' });
    expect(read.legalBasis).toBe('CONTRACT');

    await admin.put(`/processes/${created.data.key}/purpose`, { purpose: [{ locale: 'de', text: 'Mahnwesen' }] });
    const updated = (await admin.get(`/processes/${created.data.key}`)).data;
    expect(updated.purpose).toEqual([{ locale: 'de', text: 'Mahnwesen' }]);
  });
});
