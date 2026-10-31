#!/usr/bin/env bun
// Times the scripted sim in headless Chromium (#194, step 5), on the TS
// Core and on the Zig Core's WASM reactor, under both Movement rules.
// Each Core gets a Chromium of its own, so neither warms the other.
// Prints JSON.
//
//   bun tools/scripted-browser.ts --wasm path/to/talk.wasm [--chrome path]
//     [--day 100] [--ticks 500]
//
// talk.wasm isn't in @northtalk/ts: build it from the NorthTalk tag the
// package pins with `zig build -Dtarget=wasm32-wasi` in impl/zig.
// Chromium comes from --chrome, $CHROME, or Playwright's cache.
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const here = import.meta.dir;
const web = resolve(here, '../web');
const args = Bun.argv.slice(2);
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

const wasmPath = option('--wasm');
if (!wasmPath) {
  console.error('Pass --wasm path/to/talk.wasm');
  process.exit(1);
}
const talkWasm = readFileSync(wasmPath);

// The page imports @northtalk/ts, which only web/ installs.
const built = await Bun.build({
  entrypoints: [resolve(here, 'scripted-browser/page.ts')],
  plugins: [
    {
      name: 'northtalk-from-web',
      setup: build => {
        build.onResolve({ filter: /^@northtalk\/ts/ }, ({ path }) => ({
          path: Bun.resolveSync(path, web)
        }));
      }
    }
  ],
  target: 'browser'
});
if (!built.success) {
  console.error(built.logs.join('\n'));
  process.exit(1);
}
const page = await built.outputs[0]!.text();

const server = Bun.serve({
  fetch: request => {
    const path = new URL(request.url).pathname;
    if (path === '/') {
      return new Response(
        '<!doctype html><meta charset="utf-8"><script type="module" src="/page.js"></script>',
        { headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }
    if (path === '/page.js') {
      return new Response(page, {
        headers: { 'content-type': 'text/javascript; charset=utf-8' }
      });
    }
    if (path === '/talk.wasm') {
      return new Response(talkWasm, {
        headers: { 'content-type': 'application/wasm' }
      });
    }
    if (path.startsWith('/assets/') || path.startsWith('/demos/')) {
      const file = Bun.file(join(web, 'public', path));
      return new Response(file);
    }
    return new Response('Not found', { status: 404 });
  },
  hostname: '127.0.0.1',
  port: 0
});

const playwrightChrome = (): string | undefined => {
  for (const dir of [
    join(homedir(), 'Library/Caches/ms-playwright'),
    join(homedir(), '.cache/ms-playwright')
  ]) {
    try {
      const shell = readdirSync(dir)
        .filter(d => d.startsWith('chromium_headless_shell-'))
        .sort()
        .at(-1);
      if (shell) {
        const platform = readdirSync(join(dir, shell)).find(d =>
          d.startsWith('chrome-headless-shell')
        )!;
        return join(dir, shell, platform, 'chrome-headless-shell');
      }
    } catch {
      // Not this platform's cache.
    }
  }
  return undefined;
};
const chrome = option('--chrome') ?? process.env.CHROME ?? playwrightChrome();
if (!chrome) {
  console.error(
    'No Chromium: pass --chrome, set $CHROME, or install Playwright'
  );
  process.exit(1);
}

const measureOn = async (core: 'ts' | 'wasm'): Promise<unknown> => {
  const profile = mkdtempSync(join(tmpdir(), 'wime-chrome-'));
  const query = `core=${core}&day=${option('--day') ?? 100}&ticks=${
    option('--ticks') ?? 500
  }`;
  const browser = Bun.spawn(
    [
      chrome,
      '--headless',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      `${server.url}?${query}`
    ],
    { stderr: 'ignore', stdout: 'ignore' }
  );
  try {
    let port = '';
    for (let tries = 0; !port && tries < 100; tries++) {
      await Bun.sleep(100);
      try {
        port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split(
          '\n'
        )[0]!;
      } catch {
        // Not listening yet.
      }
    }
    const targets = (await (
      await fetch(`http://127.0.0.1:${port}/json`)
    ).json()) as { type: string; webSocketDebuggerUrl: string }[];
    const target = targets.find(t => t.type === 'page')!;
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(done =>
      socket.addEventListener('open', done, { once: true })
    );
    let id = 0;
    const evaluate = (expression: string) =>
      new Promise<unknown>((done, fail) => {
        const mine = ++id;
        const listen = (event: MessageEvent) => {
          const reply = JSON.parse(String(event.data)) as {
            error?: { message: string };
            id?: number;
            result?: {
              exceptionDetails?: { text: string };
              result: { value: unknown };
            };
          };
          if (reply.id !== mine) {
            return;
          }
          socket.removeEventListener('message', listen);
          if (reply.error || reply.result?.exceptionDetails) {
            fail(
              new Error(
                reply.error?.message ?? reply.result?.exceptionDetails?.text
              )
            );
          } else {
            done(reply.result!.result.value);
          }
        };
        socket.addEventListener('message', listen);
        socket.send(
          JSON.stringify({
            id: mine,
            method: 'Runtime.evaluate',
            params: { awaitPromise: true, expression, returnByValue: true }
          })
        );
      });
    // The module may not have run yet when the page target appears.
    for (let tries = 0; tries < 100; tries++) {
      if (await evaluate('typeof results !== "undefined"')) {
        break;
      }
      await Bun.sleep(100);
    }
    return await evaluate('results');
  } finally {
    browser.kill();
  }
};

const results = [];
for (const core of ['ts', 'wasm'] as const) {
  results.push(await measureOn(core));
}
console.log(JSON.stringify(results, null, 2));
await server.stop(true);
