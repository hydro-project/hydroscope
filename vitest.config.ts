import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks', // Use fork pool to avoid CJS issues
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/_DEPRECATED_*/**'],
    // Suppress noisy console output in tests by default; set ENABLE_TEST_LOGS=true to see logs
    onConsoleLog(log, type) {
      if (process.env.ENABLE_TEST_LOGS === 'true') {
        return;
      }
      // Returning false prevents Vitest from printing the log
      return false;
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/_DEPRECATED_*/**', '**/dist/**', '**/*.config.*']
    },
    // Exit cleanly after tests complete (no watch mode by default)
    watch: false,
    // Global setup for displaying final status messages
    globalSetup: ['src/__tests__/global-teardown.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/bridges': path.resolve(__dirname, './src/bridges'),
      '@/components': path.resolve(__dirname, './src/components')
    }
  }
});