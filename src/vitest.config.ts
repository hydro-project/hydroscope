import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks', // Use fork pool to avoid CJS issues
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/_DEPRECATED_*/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/_DEPRECATED_*/**', '**/dist/**', '**/*.config.*']
    },
    // Exit cleanly after tests complete (no watch mode by default)
    watch: false,
    // Global setup for displaying final status messages
    globalSetup: ['__tests__/global-teardown.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/shared': path.resolve(__dirname, './shared'),
      '@/core': path.resolve(__dirname, './core'),
      '@/bridges': path.resolve(__dirname, './bridges'),
      '@/components': path.resolve(__dirname, './components')
    }
  }
});
