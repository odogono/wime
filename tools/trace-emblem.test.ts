import { expect, test } from 'bun:test';

import { composeEmblem, fitTrace } from './trace-emblem';

const TRACE =
  '<svg viewBox="0 0 10 20"><g transform="scale(0.1)" fill="#000000"><path d="M0 0h1v1z"/></g></svg>';

test('fits a trace into its box in parchment', () => {
  expect(fitTrace(TRACE, { height: 4, width: 3, x: 1, y: 2 })).toBe(
    '<svg x="1" y="2" width="3" height="4" viewBox="0 0 10 20"><g transform="scale(0.1)" fill="#f0e4c4"><path d="M0 0h1v1z"/></g></svg>'
  );
});

test('rims a mark in ink and lays a weapon point up and to the right', () => {
  const weapon = composeEmblem('mark', TRACE);
  expect(weapon).toContain('<g transform="rotate(135 32 32)">');
  expect(weapon).toContain('stroke="#3a2c1c"');
  expect(weapon).toContain('paint-order="stroke"');
  expect(composeEmblem('mark', TRACE, true)).not.toContain('rotate');
});
