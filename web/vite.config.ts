import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // The game, the soundboard for trying its sounds, and the Atlas map
      // prototype (ADR-0006).
      input: {
        atlas: resolve(import.meta.dirname, 'atlas.html'),
        main: resolve(import.meta.dirname, 'index.html'),
        soundboard: resolve(import.meta.dirname, 'soundboard.html')
      }
    }
  },
  root: import.meta.dirname
});
