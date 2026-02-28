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

for (const u of USERS) {
  setup(`create ${u.username}`, async ({ page }) => {
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

    // Navigate to the app so we can set localStorage on the right origin
    await page.goto('/login');

    // Inject token and user into localStorage
    await page.evaluate(
      ([token, userData]) => {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(userData));
      },
      [accessToken, user] as [string, unknown],
    );

    // Save authenticated browser state
    fs.mkdirSync(path.join(process.cwd(), '.auth'), { recursive: true });
    await page.context().storageState({ path: path.join(process.cwd(), u.state) });
  });
}
