/* Vitest config: runs test/**\/*.test.ts only; timeouts are generous because every test drives Chromium. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    maxWorkers: 4,
  },
});
