import { expect, test } from 'bun:test';

import { markPages } from './extract-manual';

test('marks each page and drops the trailing form feed', () => {
  expect(markPages('one\n\ftwo  \n\f')).toBe(
    '--- page 1 ---\none\n\n--- page 2 ---\ntwo\n'
  );
});
