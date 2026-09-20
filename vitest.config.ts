import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    exclude: ['test/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'test/**',
        'coverage/**'
      ]
    },
    setupFiles: ['./test/setup.ts']
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@shared': path.resolve(import.meta.dirname, './src/shared')
    }
  }
});
