import { expect, test } from 'bun:test';

import { parseFinding } from './finding';

const text = (head: string, body = '**Hobbits are slow.** More.'): string =>
  `---\n${head}\n---\n${body}\n`;

const VALID =
  'kind: fact\ntopic: movement\nconfidence: documented\nsources:\n  - manual:pdf-p11\n  - observed:hobbiton-to-bree';

test('reads a finding', () => {
  expect(
    parseFinding(text(`${VALID}\nissue: 5\nsupersedes: movement-old`))
  ).toEqual({
    finding: {
      body: '**Hobbits are slow.** More.',
      confidence: 'documented',
      headline: 'Hobbits are slow.',
      issue: 5,
      kind: 'fact',
      sources: ['manual:pdf-p11', 'observed:hobbiton-to-bree'],
      supersedes: 'movement-old',
      topic: 'movement'
    }
  });
});

test('needs the frontmatter', () => {
  expect(parseFinding('**Hobbits are slow.**')).toEqual({
    errors: ['it must start with a "---" frontmatter block']
  });
});

test('rejects unknown values and missing sources', () => {
  expect(
    parseFinding(
      text('kind: rumour\ntopic: weather\nconfidence: sure\nsources:')
    )
  ).toEqual({
    errors: [
      'unknown kind "rumour"; use one of fact, lesson',
      'unknown topic "weather"; use one of map, places, forces, movement, time, combat, ai, objects, mobilisation, ui, graphics, sound, data-formats, executable, analysis',
      'unknown confidence "sure"; use one of provisional, documented, observed, confirmed',
      '"sources" needs at least one source'
    ]
  });
});

test('rejects a source without a known kind', () => {
  expect(
    parseFinding(text(VALID.replace('manual:pdf-p11', 'the manual')))
  ).toEqual({
    errors: [
      'source "the manual" isn\'t "kind:reference" with a kind of manual, observed, resource, disasm, strings, tool, iigs'
    ]
  });
});

test('files a lesson under analysis', () => {
  expect(
    parseFinding(text(VALID.replace('kind: fact', 'kind: lesson')))
  ).toEqual({ errors: ["a lesson's topic is analysis, not movement"] });
});

test('needs a bold headline', () => {
  expect(parseFinding(text(VALID, 'Hobbits are slow.'))).toEqual({
    errors: ['the text must open with a bold "**Headline sentence.**"']
  });
});

test('rejects unknown keys and stray list items', () => {
  expect(parseFinding(text(`  - manual:pdf-p1\n${VALID}\nauthor: me`))).toEqual(
    {
      errors: [
        '"  - manual:pdf-p1" is a list item outside "sources"',
        'unknown key "author"'
      ]
    }
  );
});
