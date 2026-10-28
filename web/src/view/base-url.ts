// Where the app is served from: '/' under `bun run dev`, '/wime/' on GitHub
// Pages (vite.config.ts). Bun's tests have no Vite env, so fall back to '/'.
export const BASE_URL: string = import.meta.env.BASE_URL ?? '/';
