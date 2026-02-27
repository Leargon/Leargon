import { test as setup } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const authFile = path.join(process.cwd(), '.auth/admin.json');
const tokenFile = path.join(process.cwd(), '.auth/admin-token.txt');

setup('authenticate as admin', async ({ page }) => {
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

  const { accessToken, user } = await res.json() as { accessToken: string; user: unknown };

  // Complete first-time setup (the fallback admin starts with setupCompleted=false)
  await fetch(`${backendUrl}/setup/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Navigate to the app so we can set localStorage on the right origin
  await page.goto('http://localhost:5173/login');

  // Inject token and user into localStorage
  await page.evaluate(
    ([token, userData]) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(userData));
    },
    [accessToken, user] as [string, unknown],
  );

  // Save authenticated browser state
  await page.context().storageState({ path: authFile });

  // Save raw token for use in API setup utilities
  fs.mkdirSync(path.join(process.cwd(), '.auth'), { recursive: true });
  fs.writeFileSync(tokenFile, accessToken, 'utf8');
});
