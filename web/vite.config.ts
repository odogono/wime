import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // The game, and the soundboard for trying its sounds.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        soundboard: resolve(import.meta.dirname, 'soundboard.html')
      }
    }
  },
  root: import.meta.dirname
});
