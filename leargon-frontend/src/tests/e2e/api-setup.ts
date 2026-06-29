import fs from 'node:fs';
import path from 'node:path';

function getToken(stateFile: string): string {
  // Try the plain-token shortcut first (admin has a .txt file)
  const tokenFile = stateFile.replace('.json', '-token.txt');
  const absTokenFile = path.join(process.cwd(), tokenFile);
  if (fs.existsSync(absTokenFile)) return fs.readFileSync(absTokenFile, 'utf8').trim();

  // Fall back to parsing the Playwright storage state
  const absStateFile = path.join(process.cwd(), stateFile);
  const state = JSON.parse(fs.readFileSync(absStateFile, 'utf8')) as {
    origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
  };
  return (
    state.origins?.[0]?.localStorage?.find((i) => i.name === 'auth_token')?.value ?? ''
  );
}

function backendUrl(): string {
  return process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';
}

async function apiFetch(
  urlPath: string,
  method: string,
  body: unknown,
  stateFile: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${backendUrl()}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken(stateFile)}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} → ${res.status}: ${await res.text()}`);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return {};
  return res.json() as Promise<Record<string, unknown>>;
}

export const ADMIN = '.auth/admin.json';
export const OWNER = '.auth/owner.json';

/** Username of the e2e owner persona (see auth-roles.setup.ts) — a plain ROLE_USER. */
export const OWNER_USERNAME = 'e2eowner';

/** Generate a unique name for test isolation */
export const uid = (base: string): string => `${base} ${Date.now()}`;

/** Generate a unique node/track ID for process flow (avoids DB primary-key conflicts in parallel runs) */
export const nid = (): string => crypto.randomUUID();

export const createDomain = (name: string): Promise<Record<string, unknown>> =>
  apiFetch('/business-domains', 'POST', { names: [{ locale: 'en', text: name }] }, ADMIN);

export const createEntity = (
  name: string,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch('/business-entities', 'POST', { names: [{ locale: 'en', text: name }] }, as);

export const createProcess = (
  name: string,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch('/processes', 'POST', { names: [{ locale: 'en', text: name }] }, as);

export const createOrgUnit = (
  name: string,
  as = ADMIN,
  leadUsername?: string,
): Promise<Record<string, unknown>> =>
  apiFetch(
    '/organisational-units',
    'POST',
    { names: [{ locale: 'en', text: name }], ...(leadUsername ? { businessOwnerUsername: leadUsername } : {}) },
    as,
  );

export const createServiceProvider = (
  name: string,
  processingCountries: string[] = ['DE'],
): Promise<Record<string, unknown>> =>
  apiFetch(
    '/service-providers',
    'POST',
    {
      names: [{ locale: 'en', text: name }],
      processingCountries,
      processorAgreementInPlace: true,
      subProcessorsApproved: false,
    },
    ADMIN,
  );

export const setProcessLegalBasis = (
  processKey: string,
  legalBasis: string | null,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch(`/processes/${processKey}/legal-basis`, 'PUT', { legalBasis }, as);

export const setProcessPurpose = (
  processKey: string,
  purpose: string | null,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch(
    `/processes/${processKey}/purpose`,
    'PUT',
    { purpose: purpose != null ? [{ locale: 'en', text: purpose }] : null },
    as,
  );

export const setProcessSecurityMeasures = (
  processKey: string,
  securityMeasures: string | null,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch(
    `/processes/${processKey}/security-measures`,
    'PUT',
    { securityMeasures: securityMeasures != null ? [{ locale: 'en', text: securityMeasures }] : null },
    as,
  );

export const updateCrossBorderTransfers = (
  entityKey: string,
  transfers: Array<{ destinationCountry: string; safeguard: string; notes?: string }>,
  resourceType: 'business-entities' | 'processes' = 'business-entities',
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch(
    `/${resourceType}/${entityKey}/cross-border-transfers`,
    'PUT',
    { transfers },
    as,
  );

export const createBoundedContext = (
  domainKey: string,
  name: string,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch(
    `/business-domains/${domainKey}/bounded-contexts`,
    'POST',
    { names: [{ locale: 'en', text: name }] },
    as,
  );

export const createItSystem = (
  name: string,
  extras?: Record<string, unknown>,
): Promise<Record<string, unknown>> =>
  apiFetch('/it-systems', 'POST', { names: [{ locale: 'en', text: name }], ...extras }, ADMIN);

export const linkItSystemToProcesses = (
  itSystemKey: string,
  processKeys: string[],
): Promise<Record<string, unknown>> =>
  apiFetch(`/it-systems/${itSystemKey}/linked-processes`, 'PUT', { processKeys }, ADMIN);

export const createCapability = (
  name: string,
  extras?: Record<string, unknown>,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch('/capabilities', 'POST', { names: [{ locale: 'en', text: name }], ...extras }, as);

export const saveProcessFlow = (
  processKey: string,
  nodes: Record<string, unknown>[],
  tracks: Record<string, unknown>[] = [],
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch(`/processes/${processKey}/flow`, 'PUT', { nodes, tracks }, as);

export const setProcessDescriptions = (
  processKey: string,
  descriptions: Array<{ locale: string; text: string }>,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch(`/processes/${processKey}/descriptions`, 'PUT', descriptions, as);

export const createDomainEvent = (
  publishingBoundedContextKey: string,
  name: string,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch('/domain-events', 'POST', {
    publishingBoundedContextKey,
    names: [{ locale: 'en', text: name }],
  }, as);

export const assignOwningUnitToEntity = (
  entityKey: string,
  owningUnitKey: string | null,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch(`/business-entities/${entityKey}/owning-unit`, 'PUT', { owningUnitKey }, as);

export const assignClassificationsToEntity = (
  entityKey: string,
  assignments: Array<{ classificationKey: string; valueKey: string }>,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch(`/business-entities/${entityKey}/classifications`, 'PUT', assignments, as);

export const addProcessInput = (
  processKey: string,
  entityKey: string,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch(`/processes/${processKey}/inputs`, 'POST', { entityKey }, as);

export const assignOwningUnitToProcess = (
  processKey: string,
  owningUnitKey: string | null,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch(`/processes/${processKey}/owning-unit`, 'PUT', { owningUnitKey }, as);

/** Set an entity's data owner by username (admin operation). */
export const setEntityDataOwner = (
  entityKey: string,
  dataOwnerUsername: string,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch(`/business-entities/${entityKey}/data-owner`, 'PUT', { dataOwnerUsername }, as);

/** Set a process's owner by username (admin operation). */
export const setProcessOwner = (
  processKey: string,
  processOwnerUsername: string,
  as = ADMIN,
): Promise<Record<string, unknown>> =>
  apiFetch(`/processes/${processKey}/owner`, 'PUT', { processOwnerUsername }, as);

/**
 * Create an entity as admin, then hand ownership to a (non-privileged) user.
 * Mirrors the real-world flow now that a plain user can no longer create root items.
 */
export const createEntityOwnedBy = async (
  name: string,
  ownerUsername = OWNER_USERNAME,
): Promise<Record<string, unknown>> => {
  const entity = await createEntity(name);
  await setEntityDataOwner(entity.key as string, ownerUsername);
  return entity;
};

/** Create a process as admin, then hand ownership to a (non-privileged) user. */
export const createProcessOwnedBy = async (
  name: string,
  ownerUsername = OWNER_USERNAME,
): Promise<Record<string, unknown>> => {
  const proc = await createProcess(name);
  await setProcessOwner(proc.key as string, ownerUsername);
  return proc;
};
