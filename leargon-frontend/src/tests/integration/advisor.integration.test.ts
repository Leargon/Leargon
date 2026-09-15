import { describe, it, expect, beforeAll } from 'vitest';
import type { AxiosInstance } from 'axios';
import { createClient, signup, signupAdmin, withToken, createDomain } from './testClient';
import en from '../../i18n/en';
import de from '../../i18n/de';
import fr from '../../i18n/fr';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

const names = (text: string) => [{ locale: 'en', text }];

interface RuleSet {
  code: string;
  questions: Array<{ code: string; answerType: string; options?: Array<{ code: string; rationaleCode?: string | null }> }>;
  outcomes: Array<{ code: string; rationaleCodes: string[]; consequenceCodes: string[] }>;
}

/** Resolves a dotted i18n key ("advisor.questions.entity.relation") in a translation tree. */
const lookup = (tree: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), tree);

/**
 * Guided modeling advisor. The decision tree lives in the backend; the frontend only translates codes —
 * so every code the server can emit must have a label in every shipped language.
 */
describe('Guided modeling advisor', () => {
  let admin: AxiosInstance;
  let stranger: AxiosInstance;
  let orderKey: string;
  let salesContext: string;
  let domainKey: string;

  beforeAll(async () => {
    admin = createClient(getBackendUrl());
    const auth = await signupAdmin(admin, {
      email: 'adv-admin@example.com', username: 'advadmin', password: 'password123', firstName: 'Adv', lastName: 'Admin',
    });
    withToken(admin, auth.accessToken);
    await signup(createClient(getBackendUrl()), {
      email: 'adv-owner@example.com', username: 'advowner', password: 'password123', firstName: 'Olga', lastName: 'Owner',
    });
    stranger = createClient(getBackendUrl());
    const strangerAuth = await signup(stranger, {
      email: 'adv-stranger@example.com', username: 'advstranger', password: 'password123', firstName: 'Adv', lastName: 'Stranger',
    });
    withToken(stranger, strangerAuth.accessToken);

    domainKey = (await createDomain(admin, 'ADV Sales')).key;
    salesContext = (await admin.post(`/business-domains/${domainKey}/bounded-contexts`, { names: names('ADV Ordering'), ownerUsername: 'advowner' })).data.key;
    orderKey = (await admin.post('/business-entities', { names: names('ADV Order'), boundedContextKey: salesContext })).data.key;
  });

  it('has a label in en, de and fr for every code the rule sets can emit', async () => {
    const res = await admin.get('/advisor/rule-sets');
    expect(res.status).toBe(200);
    const ruleSets = res.data as RuleSet[];
    expect(ruleSets.map((r) => r.code)).toEqual(
      expect.arrayContaining(['ENTITY_PLACEMENT', 'PROCESS_PLACEMENT', 'DOMAIN_PLACEMENT', 'ORG_UNIT_PLACEMENT', 'CAPABILITY_PLACEMENT']),
    );

    const keys = new Set<string>();
    for (const ruleSet of ruleSets) {
      keys.add(`advisor.ruleSets.${ruleSet.code}`);
      for (const q of ruleSet.questions) {
        keys.add(`advisor.questions.${q.code}`);
        for (const o of q.options ?? []) {
          keys.add(q.answerType === 'BOOLEAN' ? `advisor.options.${o.code}` : `advisor.options.${q.code}.${o.code}`);
          if (o.rationaleCode) keys.add(`advisor.rationales.${o.rationaleCode}`);
        }
      }
      for (const outcome of ruleSet.outcomes) {
        keys.add(`advisor.outcomes.${outcome.code}`);
        outcome.rationaleCodes.forEach((c) => keys.add(`advisor.rationales.${c}`));
        outcome.consequenceCodes.forEach((c) => keys.add(`advisor.consequences.${c}`));
      }
    }

    const missing = [...keys].flatMap((key) =>
      Object.entries({ en, de, fr })
        .filter(([, tree]) => typeof lookup(tree, key) !== 'string')
        .map(([lang]) => `${lang}:${key}`),
    );
    expect(missing).toEqual([]);
  });

  const connectedTo = (key: string) => [
    { questionCode: 'entity.relation', optionCode: 'connected' },
    { questionCode: 'entity.relatedPick', itemKey: key },
  ];

  it('recommends "Order Line" as a child of "Order" when it shares lifecycle, identity and responsibility', async () => {
    const res = await admin.post('/advisor/evaluate', {
      ruleSetCode: 'ENTITY_PLACEMENT',
      proposedNames: names('ADV Order Line'),
      answers: [
        ...connectedTo(orderKey),
        { questionCode: 'entity.lifecycle', optionCode: 'yes' },
        { questionCode: 'entity.identity', optionCode: 'no' },
        { questionCode: 'entity.responsibility', optionCode: 'no' },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.data.status).toBe('RECOMMENDATION');
    const rec = res.data.recommendation;
    expect(rec.outcomeCode).toBe('CHILD_AGGREGATE');
    expect(rec.prefill.parentKey).toBe(orderKey);
    expect(rec.rationaleCodes).toEqual(['lifecycleBound', 'noOwnIdentity', 'sharedResponsibility']);
    expect(rec.allowed).toBe(true);
    expect(rec.consequences.map((c: { code: string }) => c.code)).toContain('ENTITY_ROLLS_UP_TO_ROOT');
  });

  it('recommends a new root entity with a relationship, and creates both in one request', async () => {
    const rec = (
      await admin.post('/advisor/evaluate', {
        ruleSetCode: 'ENTITY_PLACEMENT',
        answers: [
          ...connectedTo(orderKey),
          { questionCode: 'entity.lifecycle', optionCode: 'yes' },
          { questionCode: 'entity.identity', optionCode: 'yes' },
          { questionCode: 'entity.cardinality', optionCode: 'many' },
        ],
      })
    ).data.recommendation;

    expect(rec.outcomeCode).toBe('ROOT_WITH_RELATIONSHIP');
    expect(rec.rationaleCodes).toEqual(['lifecycleBound', 'ownIdentity']);
    expect(rec.prefill.boundedContextKey).toBe(salesContext);
    const rel = rec.prefill.relationship;
    expect(rel).toMatchObject({ relatedEntityKey: orderKey, firstCardinalityMinimum: 0, secondCardinalityMinimum: 1, secondCardinalityMaximum: 1 });

    const created = await admin.post('/business-entities', {
      names: names('ADV Shipment'),
      boundedContextKey: rec.prefill.boundedContextKey,
      relationships: [{
        secondEntityKey: rel.relatedEntityKey,
        firstCardinalityMinimum: rel.firstCardinalityMinimum,
        firstCardinalityMaximum: rel.firstCardinalityMaximum ?? null,
        secondCardinalityMinimum: rel.secondCardinalityMinimum,
        secondCardinalityMaximum: rel.secondCardinalityMaximum ?? null,
      }],
    });
    expect(created.status).toBe(201);
    const shipment = (await admin.get(`/business-entities/${created.data.key}`)).data;
    expect(shipment.parent ?? null).toBeNull();
    expect(shipment.relationships).toHaveLength(1);
  });

  it('links an implementation to its interface in the create request', async () => {
    const created = await admin.post('/business-entities', {
      names: names('ADV Business Order'),
      boundedContextKey: salesContext,
      interfaces: [orderKey],
    });
    expect(created.status).toBe(201);
    const entity = (await admin.get(`/business-entities/${created.data.key}`)).data;
    expect(entity.interfacesEntities.map((e: { key: string }) => e.key)).toEqual([orderKey]);
  });

  it('refuses an impossible cardinality on create (400)', async () => {
    const res = await admin.post('/business-entities', {
      names: names('ADV Broken Shipment'),
      boundedContextKey: salesContext,
      relationships: [{ secondEntityKey: orderKey, firstCardinalityMinimum: 2, firstCardinalityMaximum: 1, secondCardinalityMinimum: 0 }],
    });
    expect(res.status).toBe(400);
  });

  it('asks the next question while the path is incomplete, naming the picked entity', async () => {
    const res = await admin.post('/advisor/evaluate', {
      ruleSetCode: 'ENTITY_PLACEMENT',
      answers: connectedTo(orderKey),
    });

    expect(res.status).toBe(200);
    expect(res.data.status).toBe('QUESTION');
    expect(res.data.question.code).toBe('entity.lifecycle');
    expect(res.data.question.params.picked).toBe('ADV Order');
  });

  it('starts from the entity an "Add child" wizard was opened on', async () => {
    const res = await admin.post('/advisor/evaluate', { ruleSetCode: 'ENTITY_PLACEMENT', contextItemKey: orderKey, answers: [] });
    expect(res.status).toBe(200);
    expect(res.data.question.code).toBe('entity.lifecycle');
    expect(res.data.question.params.picked).toBe('ADV Order');
  });

  it('starts from a domain ("Add subdomain"): the kind is asked, the domain is used for the placement', async () => {
    const question = await admin.post('/advisor/evaluate', { ruleSetCode: 'DOMAIN_PLACEMENT', contextItemKey: domainKey, answers: [] });
    expect(question.data.question.code).toBe('domain.kind');

    const rec = (
      await admin.post('/advisor/evaluate', {
        ruleSetCode: 'DOMAIN_PLACEMENT',
        contextItemKey: domainKey,
        answers: [{ questionCode: 'domain.kind', optionCode: 'subArea' }],
      })
    ).data.recommendation;
    expect(rec.outcomeCode).toBe('SUBDOMAIN');
    expect(rec.prefill.parentKey).toBe(domainKey);
  });

  it('refuses a start item that is not of the rule set\'s start type (400)', async () => {
    const res = await admin.post('/advisor/evaluate', { ruleSetCode: 'DOMAIN_PLACEMENT', contextItemKey: orderKey, answers: [] });
    expect(res.status).toBe(400);
  });

  it('tells a user who may not create there whom to ask', async () => {
    const res = await stranger.post('/advisor/evaluate', {
      ruleSetCode: 'ENTITY_PLACEMENT',
      answers: [
        { questionCode: 'entity.relation', optionCode: 'standalone' },
        { questionCode: 'entity.contextPick', itemKey: salesContext },
      ],
    });

    expect(res.status).toBe(200);
    const rec = res.data.recommendation;
    expect(rec.outcomeCode).toBe('NEW_ROOT_IN_CONTEXT');
    expect(rec.allowed).toBe(false);
    expect(rec.responsibleOwner.username).toBe('advowner');
  });

  it('rejects an answer that is not an option of the question (400)', async () => {
    const res = await admin.post('/advisor/evaluate', {
      ruleSetCode: 'ENTITY_PLACEMENT',
      answers: [{ questionCode: 'entity.relation', optionCode: 'somethingElse' }],
    });
    expect(res.status).toBe(400);
  });

  it('requires authentication (401)', async () => {
    const res = await createClient(getBackendUrl()).post('/advisor/evaluate', { ruleSetCode: 'ENTITY_PLACEMENT', answers: [] });
    expect(res.status).toBe(401);
  });
});
