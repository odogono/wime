import { describe, expect, test } from 'bun:test';

import { assetsExist, loadSoakAssets, soakRun, summarise } from './soak';

describe.skipIf(!assetsExist())('soak runner', () => {
  test('plays a seeded campaign to an ending, saving every day', () => {
    const assets = loadSoakAssets();
    const run = soakRun(1, assets, 400);
    expect(run.outcome.kind).toBe('ending');
    expect(soakRun(1, assets, 400)).toEqual(run);
  });

  test('reports a run that outlasts the day cap as a possible softlock', () => {
    const run = soakRun(1, loadSoakAssets(), 1);
    expect(run.outcome.kind).toBe('softlock');
    expect(summarise([run])).toContain('seed 1 softlock');
  });
});
