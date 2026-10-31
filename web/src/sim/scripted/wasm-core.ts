// The Zig Core's WASM reactor, for the browser benchmark to hand the host
// (#194, step 5). The sim itself runs on the TS Core.
export { createCore as createWasmCore } from '@northtalk/ts/wasm';
