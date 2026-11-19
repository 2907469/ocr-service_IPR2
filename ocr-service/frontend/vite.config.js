import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// Source maps нужны, чтобы Sentry показывал ошибки в исходном коде, а не в минифицированном бандле.
// Загрузка карт в Sentry включается только если заданы SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT.
const uploadMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

export default defineConfig({
  plugins: [
    react(),
    uploadMaps &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      }),
  ].filter(Boolean),
  build: { sourcemap: true },
});
