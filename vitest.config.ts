import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.next', 'build'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/dist/',
        '**/.next/',
      ],
    },
  },
  resolve: {
    alias: {
      '@dragon/core': path.resolve(__dirname, './packages/core/src'),
      '@dragon/api': path.resolve(__dirname, './packages/api/src'),
    },
  },
})

