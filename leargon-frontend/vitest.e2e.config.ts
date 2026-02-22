import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/e2e/**/*.e2e.test.ts'],
    globalSetup: ['src/tests/e2e/globalSetup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    isolate: false,
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/e2e-results.xml',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
