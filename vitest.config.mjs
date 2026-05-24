import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Strip Next.js 'use client' / 'use server' directives so @vitejs/plugin-react
// can inject its HMR preamble at the top of each file.
const stripNextDirectives = {
  name: 'strip-next-directives',
  transform(code) {
    return code.replace(/^['"]use (client|server)['"];\s*\n?/m, '');
  },
};

export default defineConfig({
  plugins: [stripNextDirectives, react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
