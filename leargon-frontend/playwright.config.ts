import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'src/tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  timeout: 60_000,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/playwright-results.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    // Auth setup runs first (saves .auth/admin.json + .auth/admin-token.txt)
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // Role setup depends on admin setup (saves .auth/owner.json + .auth/viewer.json)
    { name: 'setup-roles', testMatch: /auth-roles\.setup\.ts/, dependencies: ['setup'] },
    // Main tests use saved admin auth state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/admin.json',
      },
      dependencies: ['setup', 'setup-roles'],
      testIgnore: /auth(-roles)?\.setup\.ts/,
    },
  ],
  globalSetup: 'src/tests/e2e/global-setup.ts',
});
