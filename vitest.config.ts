/* Vitest config: runs test/**\/*.test.ts only; timeouts are generous because every test drives Chromium. Cap file workers at both four and the process's CPU affinity so a two-core CI runner is not oversubscribed. */
import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    maxWorkers: Math.min(4, availableParallelism()),
  },
});
