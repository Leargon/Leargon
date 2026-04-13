import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/unit/**/*.unit.test.ts'],
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/unit-results.xml',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
