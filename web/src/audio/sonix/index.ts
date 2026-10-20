// The Sonix Music Driver, headless: plays the game's SMUS scores and its
// instruments into stereo sample buffers (ADR-0005). A port of nuade's
// players/sonix (MIT licence, see the notice in each ported file), itself a
// port of the driver's 68000 code (finding:sound-game-carries-the-sonix-driver).
// Pure and deterministic: the same calls render the same samples.
import { createEngine } from './engine';
import {
  loadInstrument,
  type SonixFiles,
  type SonixInstrument
} from './instruments';
import { createMixer } from './mixer';
import { parseScore } from './score';
import { CIA_CLOCK_PAL, firstTickLength } from './tables';

export type { SonixFiles, SonixInstrument } from './instruments';
export { SonixScoreError } from './score';

export type SonixVoice = 0 | 1 | 2 | 3;

export interface Sonix {
  // Load an instrument by name, with or without `.instr`.
  loadInstrument(name: string, files: SonixFiles): SonixInstrument | undefined;
  // Load the score's INS1 instruments and start it from the beginning, to
  // play once through. Throws SonixScoreError on a malformed score.
  playScore(smus: Uint8Array, files: SonixFiles): void;
  // The driver's ReleaseNOTE.
  releaseNote(voice: SonixVoice): void;
  // Fill both arrays (the same length) with the next samples, in [-1, 1].
  render(left: Float32Array, right: Float32Array): void;
  // False once the score has played through or been stopped.
  readonly scorePlaying: boolean;
  // The driver's StartNOTE; the game's effects use voice 3, velocity 255.
  startNote(
    voice: SonixVoice,
    instrument: SonixInstrument,
    note: number,
    velocity: number
  ): void;
  // Stop the score, releasing its notes.
  stopScore(): void;
}

export const createSonix = (sampleRate: number): Sonix => {
  const mixer = createMixer(sampleRate);
  const engine = createEngine(mixer);
  // Output frames are counted in CIA cycles x sampleRate, so that ticks fall
  // on the exact frame without drift: each frame costs CIA_CLOCK_PAL, each
  // tick adds its length x sampleRate.
  let untilTick = engine.tick() * sampleRate;

  return {
    loadInstrument: (name, files) => loadInstrument(name, files),
    playScore(smus, files) {
      const score = parseScore(smus);
      const instruments = new Map<number, SonixInstrument>();
      let previousSynth: SonixInstrument | undefined;
      for (const register of [...score.instruments.keys()].sort(
        (a, b) => a - b
      )) {
        const instrument = loadInstrument(
          score.instruments.get(register)!,
          files
        );
        if (!instrument) {
          continue;
        }
        instruments.set(register, instrument);
        // The loader packs the synthesised instruments' filter banks back to
        // back in register order (nuade's snx_filter_bank_byte_after).
        if (instrument.kind === 'synthesis') {
          if (previousSynth?.kind === 'synthesis') {
            previousSynth.nextBankByte = instrument.filterBank[0]!;
          }
          previousSynth = instrument;
        }
      }
      engine.startScore(score, instruments);
      // PlaySCORE's first tick only waits, at the rate the SHDR volume byte
      // set (nuade's first_tick_length).
      untilTick = firstTickLength(score.volumeByte) * sampleRate;
    },
    releaseNote: voice => engine.releaseNote(voice),
    render(left, right) {
      const frames = Math.min(left.length, right.length);
      let frame = 0;
      while (frame < frames) {
        if (untilTick <= 0) {
          untilTick += engine.tick() * sampleRate;
          continue;
        }
        const run = Math.min(
          frames - frame,
          Math.ceil(untilTick / CIA_CLOCK_PAL)
        );
        mixer.mix(left, right, frame, frame + run);
        frame += run;
        untilTick -= run * CIA_CLOCK_PAL;
      }
    },
    get scorePlaying() {
      return engine.playing;
    },
    startNote: (voice, instrument, note, velocity) =>
      engine.startNote(voice, instrument, note, velocity),
    stopScore: () => engine.stopScore()
  };
};
