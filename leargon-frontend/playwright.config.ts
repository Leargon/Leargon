import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'src/tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  timeout: 60_000,
  workers: 2,
  reporter: [
    ['line'],
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
    // Main bulk — runs in parallel (workers > 1). Excludes the two specs that mutate the shared,
    // app-wide methodology/verification config; those run afterwards in their own serial phases.
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/admin.json',
      },
      dependencies: ['setup', 'setup-roles'],
      testIgnore: [/auth(-roles)?\.setup\.ts/, /methodology-settings\.spec\.ts/, /field-verification\.spec\.ts/],
    },
    // Config-mutating specs run AFTER the parallel bulk, chained so they never overlap each other or
    // the bulk (both PUT the global methodology config, which would otherwise race concurrent specs).
    {
      name: 'chromium-methodology',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/admin.json' },
      dependencies: ['chromium'],
      testMatch: /methodology-settings\.spec\.ts/,
    },
    {
      name: 'chromium-verification',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/admin.json' },
      dependencies: ['chromium-methodology'],
      testMatch: /field-verification\.spec\.ts/,
    },
  ],
  globalSetup: 'src/tests/e2e/global-setup.ts',
});
