import { test as setup } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const authFile = path.join(process.cwd(), '.auth/admin.json');
const tokenFile = path.join(process.cwd(), '.auth/admin-token.txt');

setup('authenticate as admin', async () => {
  const backendUrl = process.env.E2E_BACKEND_URL;
  if (!backendUrl) throw new Error('E2E_BACKEND_URL not set — is global-setup running?');

  // Login via backend API directly to get a JWT token
  const res = await fetch(`${backendUrl}/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@e2e-test.local', password: 'AdminPass123!' }),
  });

  if (!res.ok) {
    throw new Error(`Admin login failed: ${res.status} ${await res.text()}`);
  }

  const { accessToken, user } = await res.json() as { accessToken: string; user: Record<string, unknown> };

  // Complete first-time setup (the fallback admin starts with setupCompleted=false)
  await fetch(`${backendUrl}/setup/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Force setupCompleted: true — /setup/complete above updates the DB; no need to re-fetch
  const storedUser = { ...user, setupCompleted: true };

  // Write Playwright storage state directly — no browser page needed just to set localStorage
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:5173',
        localStorage: [
          { name: 'auth_token', value: accessToken },
          { name: 'auth_user', value: JSON.stringify(storedUser) },
        ],
      },
    ],
  };

  fs.mkdirSync(path.join(process.cwd(), '.auth'), { recursive: true });
  fs.writeFileSync(authFile, JSON.stringify(storageState), 'utf8');
  fs.writeFileSync(tokenFile, accessToken, 'utf8');
});
