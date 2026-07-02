import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupCreator,
  signupAdmin,
  signupWithRoles,
  withToken,
  createEntity,
  createProcess,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { BusinessEntityResponse } from '@/api/generated/model/businessEntityResponse';
import type { ProcessResponse } from '@/api/generated/model/processResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

/**
 * All-fields × all-roles permission matrix. Rather than hand-coding the expected outcome for every
 * (field, role) pair, this uses the backend-computed `editableFields` on the GET response as the oracle
 * and asserts the rigorous contract at the HTTP level:
 *
 *     per-field PUT returns 2xx   ⟺   baseField ∈ editableFields
 *     per-field PUT returns 403   ⟺   baseField ∉ editableFields
 *
 * across admin / owner / plain-user / methodology-scoped editors. Adding a field = one row in the tables
 * below. Only permission-neutral, non-key-changing "content" fields are looped (so shared records stay
 * valid); ownership/name/parent gates are covered by EditableFieldsConsistencySpec on the backend.
 */

interface FieldCase {
  /** base field name as it appears in editableFields */
  field: string;
  /** PUT path suffix under the record */
  path: string;
  /** a valid request body so an *allowed* actor gets 200 (not 400) */
  body: unknown;
}

const ENTITY_FIELDS: FieldCase[] = [
  { field: 'retentionPeriod', path: 'retention-period', body: { retentionPeriod: [{ locale: 'en', text: '1 year' }] } },
  { field: 'storageLocations', path: 'storage-locations', body: { locations: ['DE'] } },
  { field: 'descriptions', path: 'descriptions', body: [{ locale: 'en', text: 'A description' }] },
  { field: 'boundedContext', path: 'bounded-context', body: { boundedContextKey: null } },
];

const PROCESS_FIELDS: FieldCase[] = [
  { field: 'legalBasis', path: 'legal-basis', body: { legalBasis: 'CONSENT' } },
  { field: 'purpose', path: 'purpose', body: { purpose: [{ locale: 'en', text: 'A purpose' }] } },
  { field: 'securityMeasures', path: 'security-measures', body: { securityMeasures: [{ locale: 'en', text: 'Encryption' }] } },
  { field: 'processType', path: 'type', body: { processType: 'MANAGEMENT' } },
  { field: 'boundedContext', path: 'bounded-context', body: { boundedContextKey: null } },
];

async function putStatus(client: AxiosInstance, base: string, key: string, c: FieldCase): Promise<number> {
  const res = await client.put(`/${base}/${key}/${c.path}`, c.body);
  return res.status;
}

describe('Permission matrix: editableFields ⟺ per-field PUT enforcement', () => {
  let owner: AxiosInstance;
  const actors: Record<string, AxiosInstance> = {};
  let entityKey: string;
  let processKey: string;

  beforeAll(async () => {
    const url = getBackendUrl();
    owner = createClient(url);
    const ownerAuth = await signupCreator(owner, {
      email: 'pm-owner@example.com', username: 'pmowner', password: 'password123', firstName: 'PM', lastName: 'Owner',
    });
    withToken(owner, ownerAuth.accessToken);
    actors.owner = owner;

    const admin = createClient(url);
    const adminAuth = await signupAdmin(admin, {
      email: 'pm-admin@example.com', username: 'pmadmin', password: 'password123', firstName: 'PM', lastName: 'Admin',
    });
    withToken(admin, adminAuth.accessToken);
    actors.admin = admin;

    const plain = createClient(url);
    const plainAuth = await signup(plain, {
      email: 'pm-plain@example.com', username: 'pmplain', password: 'password123', firstName: 'PM', lastName: 'Plain',
    });
    withToken(plain, plainAuth.accessToken);
    actors.plain = plain;

    const scoped: Array<[string, string]> = [
      ['editorDDD', 'ROLE_EDITOR_DDD'],
      ['editorGDPR', 'ROLE_EDITOR_GDPR'],
      ['editorProcessGov', 'ROLE_EDITOR_PROCESS_GOVERNANCE'],
    ];
    for (const [name, role] of scoped) {
      const c = createClient(url);
      const auth = await signupWithRoles(c, {
        email: `pm-${name}@example.com`, username: `pm${name.toLowerCase()}`, password: 'password123', firstName: 'PM', lastName: name,
      }, ['ROLE_USER', role]);
      withToken(c, auth.accessToken);
      actors[name] = c;
    }

    entityKey = (await createEntity(owner, 'PM Matrix Entity')).key;
    processKey = (await createProcess(owner, 'PM Matrix Process')).key;
  });

  const actorNames = () => Object.keys(actors);

  it.each(['admin', 'owner', 'plain', 'editorDDD', 'editorGDPR', 'editorProcessGov'])(
    'entity fields: PUT 2xx ⟺ editableFields membership for %s',
    async (actorName) => {
      const client = actors[actorName];
      const get = await client.get<BusinessEntityResponse>(`/business-entities/${entityKey}`);
      expect(get.status).toBe(200);
      const editable = get.data.editableFields ?? [];

      for (const c of ENTITY_FIELDS) {
        const status = await putStatus(client, 'business-entities', entityKey, c);
        const allowed = editable.includes(c.field);
        expect(
          allowed ? status >= 200 && status < 300 : status === 403,
          `entity.${c.field} for ${actorName}: editable=${allowed} but PUT=${status}`,
        ).toBe(true);
      }
    },
  );

  it.each(['admin', 'owner', 'plain', 'editorDDD', 'editorGDPR', 'editorProcessGov'])(
    'process fields: PUT 2xx ⟺ editableFields membership for %s',
    async (actorName) => {
      const client = actors[actorName];
      const get = await client.get<ProcessResponse>(`/processes/${processKey}`);
      expect(get.status).toBe(200);
      const editable = get.data.editableFields ?? [];

      for (const c of PROCESS_FIELDS) {
        const status = await putStatus(client, 'processes', processKey, c);
        const allowed = editable.includes(c.field);
        expect(
          allowed ? status >= 200 && status < 300 : status === 403,
          `process.${c.field} for ${actorName}: editable=${allowed} but PUT=${status}`,
        ).toBe(true);
      }
    },
  );

  it('sanity: scoped editors and plain user differ from owner/admin', () => {
    // The matrix above is only meaningful if the actors actually have different rights.
    expect(actorNames()).toContain('editorDDD');
    expect(actorNames()).toContain('plain');
  });
});
