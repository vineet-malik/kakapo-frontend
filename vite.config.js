import { defineConfig } from 'vite';

/** Static demo; `npm run dev` serves from repo root. */
export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        demo: './demo.html',
        dashboard: './dashboard.html',
      },
    },
  },
});
