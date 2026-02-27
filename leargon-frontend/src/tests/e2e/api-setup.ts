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
  return res.json() as Promise<Record<string, unknown>>;
}

export const ADMIN = '.auth/admin.json';
export const OWNER = '.auth/owner.json';

/** Generate a unique name for test isolation */
export const uid = (base: string): string => `${base} ${Date.now()}`;

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
): Promise<Record<string, unknown>> =>
  apiFetch('/organisational-units', 'POST', { names: [{ locale: 'en', text: name }] }, as);
