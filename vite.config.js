import { defineConfig, loadEnv } from 'vite';

/** Saat `npm run dev`, endpoint /api/compile langsung tersedia (tanpa server terpisah). */
const compileApi = {
  name: 'compile-api',
  async configureServer(server) {
    const { handleCompile } = await import('./server/compile.mjs');
    server.middlewares.use('/api/compile', (req, res) => handleCompile(req, res));
  },
};

/** /api/ai saat pengembangan; kunci server (tanpa awalan VITE_) dibaca dari .env.local. */
const aiApi = {
  name: 'ai-api',
  async configureServer(server) {
    for (const [k, v] of Object.entries(loadEnv(server.config.mode, process.cwd(), ''))) process.env[k] ??= v;
    const { handleAi } = await import('./server/ai.mjs');
    server.middlewares.use('/api/ai', (req, res) => handleAi(req, res));
  },
};

export default defineConfig({
  plugins: [compileApi, aiApi],
  build: {
    // Three.js sendiri ± 600 kB; peringatan default (500 kB) tidak berguna di sini
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: { main: 'index.html', sandbox: 'sandbox.html', gallery: 'gallery.html', admin: 'admin.html' },
    },
  },
});
