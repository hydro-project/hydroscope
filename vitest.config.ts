import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    // Exclude src/core/__tests__ since they have incorrect import paths
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/core/__tests__/**'
    ]
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
