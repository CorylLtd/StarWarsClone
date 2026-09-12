import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    // Three.js alone is most of the bundle; there is nothing to split it from.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
