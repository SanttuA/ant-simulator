import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/ant-simulator/',
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
