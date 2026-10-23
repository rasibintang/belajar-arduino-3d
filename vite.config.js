import { defineConfig } from 'vite';

/** Saat `npm run dev`, endpoint /api/compile langsung tersedia (tanpa server terpisah). */
const compileApi = {
  name: 'compile-api',
  async configureServer(server) {
    const { handleCompile } = await import('./server/compile.mjs');
    server.middlewares.use('/api/compile', (req, res) => handleCompile(req, res));
  },
};

export default defineConfig({
  plugins: [compileApi],
  build: {
    // Three.js sendiri ± 600 kB; peringatan default (500 kB) tidak berguna di sini
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: { main: 'index.html', sandbox: 'sandbox.html', gallery: 'gallery.html', admin: 'admin.html' },
    },
  },
});
