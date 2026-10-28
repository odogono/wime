import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Under `bun run dev`, POST /__snap?name=NAME writes the body to
// build/port/NAME.png, for `wime.snap` (src/view/dev-hook.ts).
const snapEndpoint = (): Plugin => ({
  configureServer: server => {
    server.middlewares.use('/__snap', (request, response) => {
      const url = new URL(request.url ?? '', 'http://localhost');
      const name = (url.searchParams.get('name') ?? 'snap').replaceAll(
        /[^\w.-]/g,
        '_'
      );
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const dir = resolve(import.meta.dirname, '../build/port');
        mkdirSync(dir, { recursive: true });
        const path = resolve(dir, `${name}.png`);
        writeFileSync(path, Buffer.concat(chunks));
        response.end(path);
      });
    });
  },
  name: 'wime-snap'
});

// GitHub Pages serves the build from /wime/ (.github/workflows/pages.yml).
export default defineConfig({
  base: process.env.WIME_BASE ?? '/',
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
  plugins: [snapEndpoint()],
  root: import.meta.dirname
});
