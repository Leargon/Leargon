import { test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const USERS = [
  {
    email: 'e2e-owner@test.local',
    username: 'e2eowner',
    password: 'OwnerPass123!',
    state: '.auth/owner.json',
  },
  {
    email: 'e2e-viewer@test.local',
    username: 'e2eviewer',
    password: 'ViewerPass123!',
    state: '.auth/viewer.json',
  },
];

function writeStorageState(stateFile: string, accessToken: string, user: unknown): void {
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:5173',
        localStorage: [
          { name: 'auth_token', value: accessToken },
          { name: 'auth_user', value: JSON.stringify(user) },
          { name: 'leargon_wizard_mode', value: 'express' },
        ],
      },
    ],
  };
  fs.mkdirSync(path.join(process.cwd(), '.auth'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), stateFile), JSON.stringify(storageState), 'utf8');
}

for (const u of USERS) {
  setup(`create ${u.username}`, async () => {
    const backendUrl = process.env.E2E_BACKEND_URL;
    if (!backendUrl) throw new Error('E2E_BACKEND_URL not set — is global-setup running?');

    // Attempt signup (ignore 409 if user already exists from a previous run)
    await fetch(`${backendUrl}/authentication/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: u.email,
        username: u.username,
        password: u.password,
        firstName: 'E2E',
        lastName: u.username,
      }),
    });

    // Login to get JWT
    const res = await fetch(`${backendUrl}/authentication/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password }),
    });

    if (!res.ok) {
      throw new Error(`Login failed for ${u.email}: ${res.status} ${await res.text()}`);
    }

    const { accessToken, user } = (await res.json()) as { accessToken: string; user: unknown };
    writeStorageState(u.state, accessToken, user);
  });
}

/**
 * A methodology-scoped LEAD (ROLE_LEAD_GDPR). Signed up, then promoted by the fallback admin (whose token
 * the admin setup wrote to .auth/admin-token.txt), then re-logged in so the JWT/user carry the role.
 */
setup('create e2e lead (ROLE_LEAD_GDPR)', async () => {
  const backendUrl = process.env.E2E_BACKEND_URL;
  if (!backendUrl) throw new Error('E2E_BACKEND_URL not set — is global-setup running?');

  const lead = { email: 'e2e-lead@test.local', username: 'e2elead', password: 'LeadPass123!' };

  await fetch(`${backendUrl}/authentication/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...lead, firstName: 'E2E', lastName: 'Lead' }),
  });

  const adminToken = fs.readFileSync(path.join(process.cwd(), '.auth/admin-token.txt'), 'utf8').trim();

  const usersRes = await fetch(`${backendUrl}/administration/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const users = (await usersRes.json()) as Array<{ id: number; email: string }>;
  const leadUser = users.find((u) => u.email === lead.email);
  if (!leadUser) throw new Error('Lead user not found after signup');

  const putRes = await fetch(`${backendUrl}/administration/users/${leadUser.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ roles: ['ROLE_USER', 'ROLE_LEAD_GDPR'] }),
  });
  if (!putRes.ok) throw new Error(`Assign role failed: ${putRes.status} ${await putRes.text()}`);

  const loginRes = await fetch(`${backendUrl}/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: lead.email, password: lead.password }),
  });
  if (!loginRes.ok) throw new Error(`Lead login failed: ${loginRes.status}`);
  const { accessToken, user } = (await loginRes.json()) as { accessToken: string; user: unknown };
  writeStorageState('.auth/lead-gdpr.json', accessToken, user);
});
