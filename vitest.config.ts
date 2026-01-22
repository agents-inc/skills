import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/cli/**/*.ts'],
      exclude: ['src/cli/**/*.test.ts', 'src/cli/index.ts', 'src/cli/commands/**/*.ts'],
    },
  },
})
