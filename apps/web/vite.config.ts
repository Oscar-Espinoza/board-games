import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
const backend = `http://127.0.0.1:${process.env.PORT ?? '3000'}`;
export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: '../../packages/shared/project.inlang',
      outdir: '../../packages/shared/src/paraglide',
      emitTsDeclarations: true,
      strategy: ['localStorage', 'preferredLanguage', 'baseLocale'],
    }),
    sveltekit(),
  ],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/socket.io': { target: backend, ws: true },
      '/health': backend,
      '/api': backend,
    },
  },
});
