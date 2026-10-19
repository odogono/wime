// The headless, deterministic simulation (ADR-0002). Nothing here may touch
// the DOM, the canvas or the wall clock: it advances by a fixed tick, draws
// from a seeded RNG and keeps all of its state serialisable. The Levels and
// Game Speed live in view/, on top of it. src/sim/tsconfig.json enforces the
// no-DOM rule.

export {};
