import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  build: { target: 'es2020', chunkSizeWarningLimit: 1000 },
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
