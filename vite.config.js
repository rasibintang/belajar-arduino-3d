import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Three.js sendiri ± 600 kB; peringatan default (500 kB) tidak berguna di sini
    chunkSizeWarningLimit: 1000,
  },
});
