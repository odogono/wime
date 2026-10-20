import { existsSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { DEFAULT_ARCHIVE } from './extract-graphics';
import {
  loadSoundFiles,
  parseInstrument,
  parseSampledSound,
  parseScore,
  type SoundFiles
} from './extract-sound';

describe.skipIf(!existsSync(DEFAULT_ARCHIVE))('the sound files', () => {
  // Loaded on first use: a skipped describe still runs its body.
  let loaded: SoundFiles | undefined;
  const disks = () => (loaded ??= loadSoundFiles(DEFAULT_ARCHIVE));
  const file = (disk: string, name: string) => disks().get(disk)!.get(name)!;
  const all = (suffix: string) =>
    [...disks().values()].flatMap(files =>
      [...files].filter(([name]) => name.endsWith(suffix))
    );

  // finding:sound-smus-score-format
  test('every score decodes into four tracks', () => {
    const scores = all('.smus').map(([name, data]) => parseScore(data, name));
    expect(scores).toHaveLength(25);
    expect(scores.every(score => score.tracks.length === 4)).toBe(true);
    const title = parseScore(file('disk1', 'title.smus'), 'title.smus');
    expect(title).toMatchObject({ name: 'TITLE.22', tempo: 0x39_7c });
    expect(title.instruments[0]).toEqual({ name: 'Snaredrum', register: 0 });
    expect(title.snx1[0]).toBe(0x88);
  });

  // finding:sound-instrument-formats
  test('every instrument is a synthesiser, a SampledSound or 8SVX', () => {
    const kinds = all('.instr').map(
      ([name, data]) => parseInstrument(data, name).kind
    );
    expect(kinds.filter(kind => kind === 'synthesis')).toHaveLength(34);
    expect(kinds.filter(kind => kind === 'sampled')).toHaveLength(12);
    expect(kinds.filter(kind => kind === 'iff')).toHaveLength(6);
    expect(
      parseInstrument(file('disk1', 'piano.instr'), 'piano.instr')
    ).toEqual({ kind: 'sampled', name: 'Piano', sample: 'Piano' });
  });

  // finding:sound-ss-sample-format
  test('a sampled sound holds one copy per octave', () => {
    const piano = parseSampledSound(file('disk1', 'piano.ss'), 'piano.ss');
    expect(piano).toMatchObject({
      baseLength: 160,
      highestOctave: 7,
      loopStart: 144,
      lowestOctave: 3
    });
    expect(piano.octaves.map(o => o.samples.length)).toEqual([
      1280, 2560, 5120, 10_240, 20_480
    ]);
  });
});
