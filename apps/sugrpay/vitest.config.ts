import { defineConfig } from 'vitest/config';

// Unit tests for the app's own server-side helpers (no React rendering here).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
