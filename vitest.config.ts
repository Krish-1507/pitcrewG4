import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 15000,
    pool: 'forks',
    poolOptions: { forks: { execArgv: ['--experimental-sqlite'] } },
  },
});
