import { expect, test } from 'bun:test';

import { crossCheck, labelCheck, renderDocument, type Entry } from './findings';

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
    crossCheck(
      [entry({ slug: 'movement-x' })],
      [
        {
          path: 'docs/spec/movement.md',
          text: 'Per finding:movement-x and finding:movement-y.'
        }
      ]
    )
  ).toEqual([
    "docs/spec/movement.md: cites finding:movement-y, which doesn't exist"
  ]);
});

test('renders chapters in topic order, headlines footnoted, superseded last', () => {
  const document = renderDocument(
    [
      entry({
        body: '**Lesson.** L.',
        headline: 'Lesson.',
        kind: 'lesson',
        slug: 'analysis-l',
        topic: 'analysis'
      }),
      entry({
        body: '**Fast.** F.',
        headline: 'Fast.',
        slug: 'movement-fast',
        supersedes: 'movement-slow'
      }),
      entry({ body: '**Slow.** S.', headline: 'Slow.', slug: 'movement-slow' }),
      entry({
        body: '**Big.** B.',
        headline: 'Big.',
        issue: 5,
        slug: 'map-big',
        topic: 'map'
      })
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

const cites = (hex: string) =>
  entry({ slug: `cites-${hex}`, sources: [`disasm:code+0x${hex}`] });

test('flags a cited routine labels.md does not name', () => {
  const listing = [
    'code+0x00000  4e55fffc  link.w a5, #$fffc',
    'code+0x00004  4e75      rts',
    'code+0x00006  4e55fffc  link.w a5, #$fffc',
    'code+0x0000a  4e75      rts'
  ].join('\n');
  const named = new Map([['code+0x00000', 'first']]);
  expect(labelCheck([cites('4')], listing, named, new Set())).toEqual([]);
  expect(labelCheck([cites('a')], listing, named, new Set())).toEqual([
    "cites-a: cites disasm:code+0xa, in the routine at code+0x00006, which docs/re/labels.md doesn't name"
  ]);
  expect(
    labelCheck([cites('a')], listing, named, new Set(['code+0x00006']))
  ).toEqual([]);
  expect(
    labelCheck([cites('4')], listing, named, new Set(['code+0x00000']))
  ).toEqual([
    'code+0x00000 is labelled or uncited: remove it from tools/findings/unlabelled-routines.txt'
  ]);
});
