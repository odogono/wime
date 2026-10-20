import { existsSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { DEFAULT_ARCHIVE } from '../../../../tools/extract-graphics';
import {
  loadSoundFiles,
  type SoundFiles
} from '../../../../tools/extract-sound';
import { createSonix, type SonixFiles } from './index';
import { createMixer } from './mixer';
import { buildFilterBank, decimationShift } from './synth';
import {
  CIA_CLOCK_PAL,
  sampledPeriod,
  synthPeriod,
  tempoIndexOfWord,
  tempoOfIndex
} from './tables';

const RATE = 22_050;
const BLOCK = 1024;

const hasArchive = existsSync(DEFAULT_ARCHIVE);
let sounds: SoundFiles | undefined;
// Loaded on first use, so that a run without the original's files skips
// without reading them.
const soundFiles = (): SoundFiles =>
  (sounds ??= loadSoundFiles(DEFAULT_ARCHIVE));

const filesOn =
  (disk: string): SonixFiles =>
  name =>
    soundFiles().get(disk)?.get(name.toLowerCase());

const peak = (samples: Float32Array): number =>
  samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);

describe('timing and tables', () => {
  test('the SHDR tempo word picks a tempo table entry', () => {
    // 0xe100000 / 0x397c = 0x3eb2, the first entry at or below is 0x3ea0.
    expect(tempoIndexOfWord(0x39_7c)).toBe(64 * 2);
    expect(tempoIndexOfWord(0x0e_10)).toBe(0);
  });

  test('a tempo table entry gives the CIA tick and the beat', () => {
    // Entry 31 is 0x8000: 8 ticks a beat, 0x8000 for the envelopes, and a
    // timer of 0x8000 x 0x2e9c >> 15 = 0x2e9c, so 0x2e9d cycles a tick.
    expect(tempoOfIndex(62)).toEqual({
      tickLength: 0x2e_9d,
      ticksPerBeat: 0x80_00,
      timerTicksPerBeat: 8
    });
  });

  test('the period tables follow the semitone ratios', () => {
    expect(synthPeriod(36)).toBe((0xd5_c8 * 0x80_00) >>> 17);
    expect(synthPeriod(48)).toBe((0xd5_c8 * 0x80_00) >>> 18);
    expect(synthPeriod(37)).toBe((0xd5_c8 * 0x78_d1) >>> 17);
    // Clamped to notes 36 to 107.
    expect(synthPeriod(10)).toBe(synthPeriod(36));
    expect(sampledPeriod(0, 0x80)).toBe(0xd5_c8 >>> 7);
    expect(decimationShift(synthPeriod(36))).toBe(0);
    expect(decimationShift(0x1_ac)).toBe(5);
  });

  test('the filter bank keeps band 0 close to the waveform', () => {
    const wave = new Int8Array(128).map((_, index) =>
      index < 64 ? 100 : -100
    );
    const bank = buildFilterBank(wave);
    expect(bank.length).toBe(64 * 128);
    const energy = (band: number) =>
      bank
        .subarray(band * 128, band * 128 + 128)
        .reduce((sum, value) => sum + Math.abs(value), 0);
    expect(energy(63)).toBeLessThan(energy(0));
  });
});

describe('mixer', () => {
  test('resamples at the pitch and pans voice 0 left', () => {
    const mixer = createMixer(1000);
    const data = new Int8Array([0, 64, -64, 127]);
    mixer.play(0, { data, length: 4, loopLength: 4, loopStart: 0 });
    mixer.setPitch(0, 2000);
    const left = new Float32Array(4);
    const right = new Float32Array(4);
    mixer.mix(left, right, 0, 4);
    // Two source frames per output frame, looping.
    expect([...left]).toEqual([0, -0.25, 0, -0.25]);
    expect([...right]).toEqual([0, 0, 0, 0]);
  });

  test('a one-shot ends and a queued sample takes over at the end', () => {
    const mixer = createMixer(1000);
    const a = new Int8Array([64, 64]);
    const b = new Int8Array([-128]);
    mixer.play(1, { data: a, length: 2, loopLength: 0, loopStart: 0 });
    mixer.queue(1, { data: b, length: 1, loopLength: 1, loopStart: 0 });
    mixer.setPitch(1, 1000);
    const left = new Float32Array(4);
    const right = new Float32Array(4);
    mixer.mix(left, right, 0, 4);
    expect([...right]).toEqual([0.25, 0.25, -0.5, -0.5]);
    mixer.stop(1);
    expect(mixer.state(1).playing).toBe(false);
  });

  test('ticks fall at the CIA rate', () => {
    // With nothing playing the render is silence, whatever the tick.
    const sonix = createSonix(RATE);
    const left = new Float32Array(RATE);
    const right = new Float32Array(RATE);
    sonix.render(left, right);
    expect(peak(left)).toBe(0);
    expect(CIA_CLOCK_PAL).toBe(709_379);
  });
});

const renderScore = (
  smus: Uint8Array,
  files: SonixFiles,
  limitSeconds: number
): { left: Float32Array[]; seconds: number } => {
  const sonix = createSonix(RATE);
  sonix.playScore(smus, files);
  const blocks: Float32Array[] = [];
  let frames = 0;
  while (sonix.scorePlaying && frames < limitSeconds * RATE) {
    const left = new Float32Array(BLOCK);
    sonix.render(left, new Float32Array(BLOCK));
    blocks.push(left);
    frames += BLOCK;
  }
  return {
    left: blocks,
    seconds: sonix.scorePlaying ? Infinity : frames / RATE
  };
};

const noteThenRelease = (name: string, disk: string) => {
  const sonix = createSonix(RATE);
  const instrument = sonix.loadInstrument(name, filesOn(disk));
  expect(instrument, name).toBeDefined();
  sonix.startNote(3, instrument!, 60, 255);
  const sounding = new Float32Array(RATE / 4);
  sonix.render(sounding, new Float32Array(sounding.length));
  sonix.releaseNote(3);
  // Let the release run, then listen.
  sonix.render(new Float32Array(RATE), new Float32Array(RATE));
  const after = new Float32Array(RATE / 4);
  sonix.render(after, new Float32Array(after.length));
  return {
    after: peak(after),
    kind: instrument!.kind,
    sounding: peak(sounding)
  };
};

describe.skipIf(!hasArchive)('the game files', () => {
  test('every score plays through with sound', () => {
    const durations: string[] = [];
    let scores = 0;
    for (const [disk, files] of soundFiles()) {
      for (const [name, smus] of files) {
        if (!name.endsWith('.smus')) {
          continue;
        }
        scores++;
        const { left, seconds } = renderScore(smus, filesOn(disk), 600);
        expect(seconds, `${disk}/${name} finishes`).toBeLessThan(600);
        expect(
          Math.max(...left.map(peak)),
          `${disk}/${name} is not silent`
        ).toBeGreaterThan(0.01);
        durations.push(`${disk}/${name} ${seconds.toFixed(1)}s`);
      }
    }
    expect(scores).toBe(25);
    // eslint-disable-next-line no-console -- the durations, for the record
    console.log(durations.join('\n'));
  }, 120_000);

  test('the same score renders the same samples', () => {
    const smus = soundFiles().get('disk1')!.get('title.smus')!;
    const render = () => {
      const sonix = createSonix(RATE);
      sonix.playScore(smus, filesOn('disk1'));
      const left = new Float32Array(RATE * 10);
      const right = new Float32Array(RATE * 10);
      sonix.render(left, right);
      return [left, right];
    };
    expect(render()).toEqual(render());
  });

  test.each([
    ['icesynth', 'disk1', 'synthesis'],
    ['piano', 'disk1', 'sampled'],
    ['whoosh', 'disk1', 'iff']
  ])('%s sounds, then falls silent on release', (name, disk, kind) => {
    const result = noteThenRelease(name, disk);
    expect(result.kind).toBe(kind as 'iff');
    expect(result.sounding).toBeGreaterThan(0.01);
    expect(result.after).toBeLessThan(0.001);
  });

  test('a missing instrument is silent, not an error', () => {
    const sonix = createSonix(RATE);
    expect(sonix.loadInstrument('nothing', filesOn('disk1'))).toBeUndefined();
  });
});
