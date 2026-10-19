import { expect, test } from 'bun:test';

import { crossCheck, renderDocument, type Entry } from './findings';

const entry = (fields: Partial<Entry>): Entry => ({
  body: '**X.** More.',
  confidence: 'confirmed',
  headline: 'X.',
  kind: 'fact',
  slug: 'movement-x',
  sources: ['disasm:0x10'],
  topic: 'movement',
  ...fields
});

test('flags a missing, self or doubly superseded finding', () => {
  expect(
    crossCheck(
      [
        entry({ slug: 'a', supersedes: 'gone' }),
        entry({ slug: 'b', supersedes: 'b' }),
        entry({ slug: 'c', supersedes: 'a' }),
        entry({ slug: 'd', supersedes: 'a' })
      ],
      []
    )
  ).toEqual([
    'a: supersedes "gone", which doesn\'t exist',
    'b: supersedes itself',
    'd: "a" is already superseded by c'
  ]);
});

test('flags a Spec citing a missing finding', () => {
  expect(
    crossCheck([entry({ slug: 'movement-x' })], [
      {
        path: 'docs/spec/movement.md',
        text: 'Per finding:movement-x and finding:movement-y.'
      }
    ])
  ).toEqual([
    'docs/spec/movement.md: cites finding:movement-y, which doesn\'t exist'
  ]);
});

test('renders chapters in topic order, headlines footnoted, superseded last', () => {
  const document = renderDocument(
    [
      entry({ body: '**Lesson.** L.', headline: 'Lesson.', kind: 'lesson', slug: 'analysis-l', topic: 'analysis' }),
      entry({ body: '**Fast.** F.', headline: 'Fast.', slug: 'movement-fast', supersedes: 'movement-slow' }),
      entry({ body: '**Slow.** S.', headline: 'Slow.', slug: 'movement-slow' }),
      entry({ body: '**Big.** B.', headline: 'Big.', slug: 'map-big', topic: 'map', issue: 5 })
    ],
    { introduction: 'Intro.', movement: 'How Forces move.' }
  );
  expect(document).toBe(
    [
      '# How War in Middle Earth worked',
      'Intro.',
      '## The map',
      '**Big.**[^map-big] B.',
      '## Movement',
      'How Forces move.',
      '**Fast.**[^movement-fast] F.\n\n_This replaces an earlier finding: "Slow."_',
      '## Lessons from the analysis',
      '**Lesson.**[^analysis-l] L.',
      '## Superseded findings',
      'Earlier findings that later evidence overturned, kept as the record of what was believed.',
      '**Slow.**[^movement-slow] S.',
      [
        '[^map-big]: `map-big`, confirmed: disasm:0x10 (#5)',
        '[^movement-fast]: `movement-fast`, confirmed: disasm:0x10',
        '[^analysis-l]: `analysis-l`, confirmed: disasm:0x10',
        '[^movement-slow]: `movement-slow`, confirmed: disasm:0x10'
      ].join('\n')
    ].join('\n\n') + '\n'
  );
});
