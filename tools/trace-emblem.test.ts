import { expect, test } from 'bun:test';

import { composeEmblem, fitTrace } from './trace-emblem';

const TRACE =
  '<svg viewBox="0 0 10 20"><g transform="scale(0.1)" fill="#000000"><path d="M0 0h1v1z"/></g></svg>';

test('fits a trace into its box in parchment', () => {
  expect(fitTrace(TRACE, { height: 4, width: 3, x: 1, y: 2 })).toBe(
    '<svg x="1" y="2" width="3" height="4" viewBox="0 0 10 20"><g transform="scale(0.1)" fill="#f0e4c4"><path d="M0 0h1v1z"/></g></svg>'
  );
});

test('puts a mark in the chief of a shield only', () => {
  const shield = composeEmblem('shield', TRACE, TRACE);
  expect(shield.match(/<svg x=/g)).toHaveLength(2);
  expect(shield).toContain('M11.5 20 L52.5 20');
  expect(() => composeEmblem('banner', TRACE, TRACE)).toThrow(
    'a banner has no chief for a mark'
  );
});
