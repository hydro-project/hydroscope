import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks',
    setupFiles: ['src/__tests__/setup.ts'],
    include: ['src/__tests__/performance/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    onConsoleLog(log, type) {
      if (process.env.ENABLE_TEST_LOGS === 'true') {
        return;
      }
      return false;
    },

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/dist/**', '**/*.config.*']
    },
    watch: false,
    // Allow running individual tests with better output
    reporter: process.env.CI ? 'default' : 'verbose',
    // Performance tests may take longer
    testTimeout: 30000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/bridges': path.resolve(__dirname, './src/bridges'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils')
    }
  }
});