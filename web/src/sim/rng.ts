// The simulation's seeded RNG (ADR-0002). The whole state is one
// serialisable number; mulberry32 is small, fast, and good enough for
// game rolls. We do not reproduce the original RNG (ADR-0002), so this
// only needs to be deterministic, not compatible.

export type RngState = number;

export const createRng = (seed: number): RngState => seed >>> 0;

// Advances the state and returns the new state plus a value in [0, 1).
export const nextRandom = (
  state: RngState
): { state: RngState; value: number } => {
  const next = (state + 0x6d_2b_79_f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { state: next, value: ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296 };
};
