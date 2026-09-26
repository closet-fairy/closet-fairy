import { fileURLToPath, URL } from 'node:url';
import babel from '@rolldown/plugin-babel';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  const apiProxyTarget = env.API_PROXY_TARGET ?? 'http://localhost:8000';

  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      babel({ cwd: import.meta.dirname, plugins: ['@emotion/babel-plugin'] }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api/': {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/vitest.setup.ts'],
      env: { TZ: 'Asia/Seoul' },
      passWithNoTests: true,
    },
  };
});
