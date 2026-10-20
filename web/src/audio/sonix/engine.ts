// Ported from nuade's Sonix player (players/sonix in
// https://github.com/emoon/nuade), itself a port of the Aegis Sonix Music
// Driver's 68000 code, under nuade's licence:
//
// MIT License
//
// Copyright (c) 2026 Daniel Collin
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.

// The driver: StartNOTE and ReleaseNOTE, the score engine that reads the
// TRAKs a beat at a time, and the per-tick work of each technique, written
// to the mixer's voices at the end of every timer tick. Follows nuade's
// sonix.c on its SMUS path; its SNX and TINY engines, AIFF technique and
// volume ramps (unused by SMUS) are left out.
import type {
  Envelope,
  SampledInstrument,
  SonixInstrument,
  SynthesisInstrument
} from './instruments';
import type { Mixer, Sample } from './mixer';
import { VOICES, type SonixScore } from './score';
import { WAVE_LENGTH, decimationShift, renderWave } from './synth';
import {
  DEFAULT_TEMPO,
  NOTE_LENGTHS,
  PAULA_CLOCK_PAL,
  beU16,
  i8,
  i16,
  sampledBasePeriod,
  sampledPeriod,
  synthPeriod,
  tempoOfIndex,
  u16,
  type Tempo
} from './tables';

// A pitch below this is no pitch: the note is dropped (SNX_MIN_SAMPLE_HZ).
const MIN_SAMPLE_HZ = 48;

// The envelope's release stage (status 2 in the asm).
const RELEASE = 6;

// The master volume and pitch scaling before any score sets them.
// Provisional: every score in the game sets volume 254 (its byte 127
// doubled) and scaling 0x80, so effects played before the first score are
// given the same.
const DEFAULT_MASTER_VOLUME = 0xfe;
const DEFAULT_PITCH_SCALING = 0x80;

type Channel = {
  activeLength: number;
  activeLoopLength: number;
  activeLoopStart: number;
  activePcm: Int8Array | null;
  // IFF: the note holds until released.
  iffHeld: boolean;
  instrument: SonixInstrument | null;
  noteOn: boolean;
  // The four-stage envelope: stage (0, 2, 4, 6) and value, 16.16.
  portPhase: number;
  portValue: number;
  sampleBaseHz: number;
  sampleHz: number;
  ssBasePeriod: number;
  ssVibratoDelay: number;
  ssVibratoIndex: number;
  synthAccumulator: number;
  synthBuffers: [Int8Array, Int8Array];
  synthDirection: number;
  synthEnvelopeAccumulator: number;
  synthEnvelopeDelay: number;
  synthEnvelopeValue: number;
  synthOutput: Int8Array;
  synthPending: boolean;
  synthPeriod: number;
  synthShift: number;
  synthSlideCounter: number;
  synthSlideDelta: number;
  useSample: boolean;
  velocity: number;
  voicePlay: boolean;
  voiceQueue: boolean;
  voiceQueued: Sample | null;
};

type Track = {
  baseVelocity: number;
  end: number;
  ended: boolean;
  hasInstrument: boolean;
  instrumentRegister: number;
  noteWait: number;
  plays: boolean;
  playsWord: number;
  position: number;
  releaseWait: number;
  start: number;
};

const newChannel = (): Channel => ({
  activeLength: 0,
  activeLoopLength: 0,
  activeLoopStart: 0,
  activePcm: null,
  iffHeld: false,
  instrument: null,
  noteOn: false,
  portPhase: 0,
  portValue: 0,
  sampleBaseHz: 0,
  sampleHz: 0,
  ssBasePeriod: 0,
  ssVibratoDelay: 0,
  ssVibratoIndex: 0,
  synthAccumulator: 0,
  synthBuffers: [new Int8Array(WAVE_LENGTH), new Int8Array(WAVE_LENGTH)],
  synthDirection: 0,
  synthEnvelopeAccumulator: 0,
  synthEnvelopeDelay: 0,
  synthEnvelopeValue: 0,
  synthOutput: new Int8Array(WAVE_LENGTH),
  synthPending: false,
  synthPeriod: 0,
  synthShift: 0,
  synthSlideCounter: 0,
  synthSlideDelta: 0,
  useSample: false,
  velocity: 0,
  voicePlay: false,
  voiceQueue: false,
  voiceQueued: null
});

// Technique class: StartNOTE stops the old note when it changes.
const technique = (instrument: SonixInstrument | null): number =>
  instrument === null
    ? 0
    : instrument.kind === 'sampled'
      ? 1
      : instrument.kind === 'synthesis'
        ? 2
        : 3;

const validLoop = (length: number, start: number, loopLength: number) =>
  loopLength > 1 && start < length && start + loopLength <= length;

const voiceSample = (
  data: Int8Array,
  length: number,
  loopStart: number,
  loopLength: number
): Sample => ({
  data,
  length,
  loopLength: validLoop(length, loopStart, loopLength) ? loopLength : 0,
  loopStart
});

// AUDxVOL as Paula reads it, 0 to 64, as a linear volume (nuade's
// snx_paula_volume: the driver's `and.w #$7F`, then Paula's clamp).
const paulaVolume = (value: number): number => Math.min(value & 0x7f, 64) / 64;

const isSynthBuffer = (channel: Channel, pcm: Int8Array | null) =>
  pcm !== null &&
  (pcm === channel.synthBuffers[0] || pcm === channel.synthBuffers[1]);

export type Engine = {
  readonly playing: boolean;
  releaseNote(voice: number): void;
  startNote(
    voice: number,
    instrument: SonixInstrument,
    note: number,
    velocity: number
  ): void;
  startScore(
    score: SonixScore,
    instruments: Map<number, SonixInstrument>
  ): void;
  stopScore(): void;
  // Run one timer tick; returns the CIA cycles to the next.
  tick(): number;
};

export const createEngine = (mixer: Mixer): Engine => {
  const channels = Array.from({ length: VOICES }, newChannel);
  let tracks: Track[] = [];
  let score: SonixScore | null = null;
  let slots = new Map<number, SonixInstrument>();
  let running = false;
  let tempo: Tempo = DEFAULT_TEMPO;
  let tempoIndex = -1;
  let prescaler = 0;
  let masterVolume = DEFAULT_MASTER_VOLUME;
  let pitchScaling = DEFAULT_PITCH_SCALING;

  const ticksPerBeat = () => tempo.ticksPerBeat;

  // SStech note start: base period and vibrato (asm lbC0014F4 state 1).
  const sampledNoteOn = (
    channel: Channel,
    instrument: SampledInstrument,
    semitone: number
  ) => {
    const tpb = ticksPerBeat();
    const delay = instrument.vibratoDelay * 0x80_00;
    channel.ssBasePeriod = sampledBasePeriod(semitone);
    channel.ssVibratoIndex = 0;
    channel.ssVibratoDelay = u16((tpb > 0 ? Math.floor(delay / tpb) : 0) >>> 1);
  };

  // StartNOTE (nuade's sonix_start_note, asm 7143-7157 and the techniques'
  // note starts).
  const startNote = (
    voice: number,
    instrument: SonixInstrument,
    requestedNote: number,
    requestedVelocity: number
  ) => {
    const channel = channels[voice]!;
    let prevActive = channel.useSample;
    let prevPlaying = prevActive && channel.portPhase < RELEASE;
    // A running synth voice keeps its DMA: only the new period and buffer
    // are written, so the old buffer plays on to its loop end.
    const prevSynthRunning =
      prevActive &&
      channel.instrument?.kind === 'synthesis' &&
      isSynthBuffer(channel, channel.activePcm);
    const prevLength = channel.activeLength;
    if (prevActive && technique(channel.instrument) !== technique(instrument)) {
      prevActive = false;
      prevPlaying = false;
    }
    let note = requestedNote;
    if (instrument.kind === 'synthesis') {
      // The note is a byte; outside 36 to 107 it is dropped, though the
      // instrument is taken (asm lbC000B0E).
      const byte = note & 0xff;
      if (byte < 36 || byte >= 108) {
        if (!prevActive) {
          channel.noteOn = false;
        }
        channel.instrument = instrument;
        return;
      }
      note = byte;
    }
    note = Math.max(1, Math.min(127, note));
    const velocity = Math.max(0, Math.min(255, requestedVelocity));
    const saved = {
      activeLength: channel.activeLength,
      activeLoopLength: channel.activeLoopLength,
      activeLoopStart: channel.activeLoopStart,
      activePcm: channel.activePcm,
      noteOn: channel.noteOn,
      sampleBaseHz: channel.sampleBaseHz,
      sampleHz: channel.sampleHz,
      useSample: channel.useSample
    };
    channel.noteOn = true;
    channel.velocity = velocity;
    channel.instrument = instrument;
    channel.useSample = false;
    channel.activePcm = null;
    channel.activeLength = 0;
    channel.activeLoopStart = 0;
    channel.activeLoopLength = 0;
    channel.sampleHz = 0;
    channel.sampleBaseHz = 0;

    if (instrument.kind === 'synthesis') {
      const hz = (PAULA_CLOCK_PAL * 32) / synthPeriod(note);
      if (hz > MIN_SAMPLE_HZ) {
        channel.useSample = true;
        channel.sampleHz = hz;
        channel.activePcm = instrument.wave;
        channel.activeLength = WAVE_LENGTH;
        channel.activeLoopLength = WAVE_LENGTH;
        if (prevSynthRunning) {
          channel.activePcm = saved.activePcm;
          channel.activeLength = prevLength;
          channel.activeLoopLength = prevLength;
        }
      }
      // Slide from the last note's period over the slide rate (asm
      // 7528-7548); the first note sets it at once.
      const period = synthPeriod(note);
      if (channel.synthPeriod !== 0) {
        const tpb = ticksPerBeat();
        const counter = u16(
          u16(
            (tpb > 0
              ? Math.floor((instrument.slideRate * 0x80_00) / tpb)
              : 0) >>> 3
          ) + 1
        );
        const difference = i16(period) - i16(channel.synthPeriod);
        const delta =
          counter === 0 ? 0 : i16(Math.trunc(difference / i16(counter)));
        channel.synthPeriod = u16(i16(period) - delta * i16(counter));
        channel.synthSlideCounter = counter;
        channel.synthSlideDelta = delta;
      } else {
        channel.synthPeriod = period;
        channel.synthSlideCounter = 0;
        channel.synthSlideDelta = 0;
      }
      if (instrument.blendRate === 0) {
        channel.synthAccumulator = 0;
      }
      channel.synthDirection = 1;
      if (instrument.envelopeLoop !== 0) {
        channel.synthEnvelopeAccumulator = 0;
        const tpb = ticksPerBeat();
        const delay = instrument.envelopeDelay * 0x80_00;
        channel.synthEnvelopeDelay = i16(
          tpb > 0 ? Math.floor(delay / tpb) >>> 2 : 0
        );
        channel.synthEnvelopeValue = instrument.envelopeTable[0]!;
      } else {
        // Loop mode 0 only clears the delay: the envelope runs on.
        channel.synthEnvelopeDelay = 0;
      }
    } else {
      // Sampled and IFF: the zone (octave) that holds the note.
      const semitone = note % 12;
      const zone = instrument.zones.find(
        candidate =>
          note >= candidate.lowNote &&
          note <= candidate.highNote &&
          candidate.samples.length > 0
      );
      if (zone) {
        if (instrument.kind === 'sampled') {
          sampledNoteOn(channel, instrument, semitone);
        }
        const period = sampledPeriod(semitone, pitchScaling);
        const hz = period > 0 ? PAULA_CLOCK_PAL / period : 0;
        if (hz > MIN_SAMPLE_HZ) {
          channel.useSample = true;
          channel.sampleHz = hz;
          channel.activePcm = zone.samples;
          channel.activeLength = zone.samples.length;
          channel.activeLoopStart = zone.loopStart;
          channel.activeLoopLength = zone.loopLength;
        }
      }
      if (!channel.useSample) {
        // No octave holds the note: it is cancelled (asm lbC01F996), and a
        // note already playing ticks on.
        channel.noteOn = saved.noteOn && prevActive;
        channel.useSample = saved.useSample && prevActive;
        channel.activePcm = saved.activePcm;
        channel.activeLength = saved.activeLength;
        channel.activeLoopStart = saved.activeLoopStart;
        channel.activeLoopLength = saved.activeLoopLength;
        channel.sampleHz = saved.sampleHz;
        channel.sampleBaseHz = saved.sampleBaseHz;
        return;
      }
    }
    if (channel.useSample) {
      channel.sampleBaseHz = channel.sampleHz;
    }
    if (channel.useSample && instrument.kind === 'iff') {
      channel.iffHeld = true;
    }
    if (
      channel.useSample &&
      !(prevSynthRunning && instrument.kind === 'synthesis')
    ) {
      channel.voicePlay = true;
    }
    if (instrument.kind !== 'iff') {
      // The score engine keeps the envelope of a note still playing (asm
      // 8203-8208).
      if (!prevPlaying) {
        channel.portPhase = 0;
      }
      if (!prevActive) {
        channel.portValue = 0;
      }
    }
  };

  // ReleaseNOTE (nuade's sonix_release_note).
  const releaseNote = (voice: number) => {
    const channel = channels[voice]!;
    const kind = channel.instrument?.kind;
    if (channel.useSample && (kind === 'sampled' || kind === 'synthesis')) {
      channel.portPhase = RELEASE;
    } else if (channel.useSample) {
      channel.iffHeld = false;
    } else {
      channel.noteOn = false;
    }
  };

  // SStech pitch each tick: triangle vibrato on the base period (asm
  // lbC0014F4 from lbC00161C).
  const sampledPitchTick = (
    channel: Channel,
    instrument: SampledInstrument
  ) => {
    const base = channel.ssBasePeriod;
    if (base === 0 || !channel.useSample) {
      return;
    }
    if (channel.ssVibratoDelay > 0) {
      channel.ssVibratoDelay--;
    } else {
      // ASL.L #7 wraps at 32 bits.
      const step =
        (Math.imul(instrument.vibratoSpeed, ticksPerBeat()) << 7) >>> 16;
      channel.ssVibratoIndex = u16(channel.ssVibratoIndex + step + 0x40);
    }
    let v = u16((channel.ssVibratoIndex >> 7) + 0x80);
    if (v & 0x1_00) {
      v ^= 0xff;
    }
    v ^= 0x80;
    const vibrato = i16(-i8(v));
    const modulation = i16(i16(vibrato * i16(instrument.vibratoDepth)) >> 7);
    const factor = u16(modulation - (i16(pitchScaling) - 0x80) + 0x10_00);
    const period = (base * factor) >>> 19;
    channel.sampleHz = period > 0 ? PAULA_CLOCK_PAL / period : 0;
  };

  // The four-stage envelope each tick: toward the stage's target at its
  // speed, bits 0-4 a base and 5-7 a shift (nuade's snx_ss_portamento_tick).
  const envelopeTick = (channel: Channel, envelope: Envelope) => {
    const phase = channel.portPhase;
    const stage = Math.min(phase >> 1, 3);
    const target = envelope.targets[stage]! * 0x1_00_00;
    const speed = envelope.speeds[stage]!;
    const shift = (speed >> 5) ^ 7;
    const base = (speed & 0x1f) + 0x21;
    const step =
      shift < 32 ? Math.floor((base * ticksPerBeat() * 8) / 2 ** shift) : 0;
    let current = channel.portValue;
    if (Math.abs(target - current) <= step) {
      current = target;
      if (phase < 4) {
        channel.portPhase = phase + 2;
      }
    } else {
      current += current > target ? -step : step;
    }
    channel.portValue = current;
    if (current === 0 && phase >= RELEASE) {
      channel.noteOn = false;
    }
  };

  // The synthesiser's modulation envelope (asm lbC000F78-lbC000F9C): after
  // its delay it scans the table; a one-shot envelope stops at the end.
  const synthEnvelopeTick = (
    channel: Channel,
    instrument: SynthesisInstrument
  ) => {
    if (channel.synthPeriod === 0) {
      return;
    }
    const delay = channel.synthEnvelopeDelay;
    if (delay < 0) {
      return;
    }
    if (delay > 0) {
      channel.synthEnvelopeDelay = delay - 1;
      return;
    }
    const delta = u16(
      Math.imul(Math.imul(instrument.envelopeRate, ticksPerBeat()), 0x40) >>> 16
    );
    const accumulator = channel.synthEnvelopeAccumulator;
    const next = u16(accumulator + delta);
    if (instrument.envelopeLoop > 0 && next < accumulator) {
      channel.synthEnvelopeDelay = -1;
      return;
    }
    channel.synthEnvelopeAccumulator = next;
    channel.synthEnvelopeValue = instrument.envelopeTable[next >> 8]!;
  };

  // The synthesiser's waveform each tick, handed to Paula through two
  // buffers: the new one starts at once on a note start, else queues behind
  // the one playing, as Paula latches a new buffer only at its loop end
  // (nuade's snx_synth_render_tick).
  const synthRenderTick = (
    voice: number,
    channel: Channel,
    instrument: SynthesisInstrument
  ) => {
    if (channel.synthPeriod === 0) {
      return;
    }
    const audible = channel.useSample && channel.noteOn;
    // The filter band from the envelope, filter base and range (asm
    // 5605-5614).
    const portHigh = Math.floor(channel.portValue / 0x1_00_00);
    const filter = i16(
      i16(
        i16(channel.synthEnvelopeValue * i16(instrument.filterEnvelope)) >> 8
      ) +
        i16(
          (instrument.filterBase ^ 0xff) -
            (Math.imul(portHigh, instrument.filterRange) >>> 8)
        )
    );
    const band = Math.min((filter & 0xff) >> 2, 63);
    const wave = instrument.filterBank.subarray(
      band * WAVE_LENGTH,
      (band + 1) * WAVE_LENGTH
    );
    const byteAfter =
      band < 63
        ? instrument.filterBank[(band + 1) * WAVE_LENGTH]!
        : instrument.nextBankByte;
    if (channel.synthSlideCounter > 0) {
      channel.synthSlideCounter--;
      channel.synthPeriod = u16(
        i16(channel.synthPeriod) + channel.synthSlideDelta
      );
    }
    const shift = decimationShift(channel.synthPeriod);
    channel.synthShift = shift;
    const state = {
      accumulator: channel.synthAccumulator,
      direction: channel.synthDirection
    };
    renderWave(
      channel.synthOutput,
      wave,
      byteAfter,
      shift,
      instrument.blendRate,
      instrument.ringRate,
      ticksPerBeat(),
      state
    );
    channel.synthAccumulator = state.accumulator;
    channel.synthDirection = state.direction;

    const looping =
      channel.useSample && isSynthBuffer(channel, channel.activePcm);
    const refresh = !audible && looping && channel.synthPending;
    if (!audible && !refresh) {
      return;
    }
    const playing = mixer.state(voice);
    const index =
      playing.playing && playing.sample?.data === channel.synthBuffers[0]
        ? 1
        : 0;
    const buffer = channel.synthBuffers[index];
    const bytes = WAVE_LENGTH >> shift;
    buffer.set(channel.synthOutput);
    const position = channel.voicePlay ? 0 : playing.position;
    if (!refresh && (!looping || position === 0)) {
      channel.synthPending = false;
      channel.activePcm = buffer;
      channel.activeLength = bytes;
      channel.activeLoopStart = 0;
      channel.activeLoopLength = bytes;
      channel.voicePlay = true;
    } else {
      channel.synthPending = true;
      channel.voiceQueued = voiceSample(buffer, bytes, 0, bytes);
      channel.voiceQueue = true;
    }
  };

  // The synthesised note's Paula period: the slid period halved into range,
  // then scaled by the envelope and the score's pitch scaling (asm
  // 7662-7673, 7708-7735).
  const synthPitchTick = (
    channel: Channel,
    instrument: SynthesisInstrument
  ) => {
    if (!channel.useSample) {
      return;
    }
    const modulation =
      i16(
        i16(channel.synthEnvelopeValue * i16(instrument.envelopePitch)) >> 7
      ) -
      (i16(pitchScaling) - 0x80);
    const factor = u16(i16(modulation + 0x10_00));
    const period =
      ((channel.synthPeriod >> (5 - channel.synthShift)) * factor) >>> 12 || 1;
    channel.sampleHz = PAULA_CLOCK_PAL / period;
  };

  // AUDxVOL for the channel, per technique, on the score engine.
  const channelVolume = (channel: Channel): number => {
    const instrument = channel.instrument;
    if (!channel.useSample || !instrument) {
      return 0;
    }
    const portHigh = Math.floor(channel.portValue / 0x1_00_00);
    if (instrument.kind === 'sampled') {
      // asm 8347-8359.
      let v = ((masterVolume + 1) * channel.velocity) >> 8;
      v = ((v + 1) * instrument.volume) >>> 8;
      return Math.floor((v * portHigh) / 1024);
    }
    if (instrument.kind === 'synthesis') {
      // asm 7687-7695: the base volume, moved by the envelope, through the
      // envelope stage or cut on release, then master volume and velocity.
      let base = instrument.volume;
      if (instrument.envelopeVolume !== 0) {
        base = u16(
          i16(base) +
            i16(
              (i16(-channel.synthEnvelopeValue) *
                i16(instrument.envelopeVolume)) >>
                8
            )
        );
      }
      let v: number;
      if (instrument.portamento) {
        v = Math.floor((base * portHigh) / 256);
      } else {
        v = channel.portPhase === RELEASE ? 0 : base;
      }
      v = (v & 0xff) + 1;
      v = (v * masterVolume) >> 8;
      v = ((v + 1) * channel.velocity) >> 8;
      return (v + 1) >> 2;
    }
    if (!channel.iffHeld) {
      return 0;
    }
    // asm 8627-8638.
    const v = ((masterVolume + 1) * channel.velocity) >> 8;
    return Math.floor(
      ((v + 1) * u16(Math.floor(instrument.volume / 2))) / 2 ** 17
    );
  };

  // What the voice did since the last tick (nuade's snx_poll_voice).
  const pollVoice = (voice: number, channel: Channel) => {
    // A note started between ticks (a game effect's StartNOTE) has not
    // reached its voice yet: there is nothing to read back.
    if (!channel.useSample || channel.voicePlay) {
      return;
    }
    const state = mixer.state(voice);
    if (state.playing && state.sample) {
      if (state.sample.data !== channel.activePcm) {
        // The queued buffer took over at the loop end.
        channel.activePcm = state.sample.data;
        channel.activeLength = state.sample.length;
        channel.activeLoopStart = state.sample.loopStart;
        channel.activeLoopLength = state.sample.loopLength;
        channel.synthPending = false;
      }
      return;
    }
    // A one-shot ran off its end: sampled and IFF notes tick on silently
    // until released (asm lbC0015D4).
    const kind = channel.instrument?.kind;
    if (!channel.activePcm || channel.activeLength === 0) {
      channel.useSample = false;
    } else if (kind !== 'sampled' && kind !== 'iff') {
      channel.noteOn = false;
      channel.useSample = false;
      channel.sampleHz = 0;
    }
  };

  // The channel's Paula registers, written to its voice (nuade's
  // snx_sync_voice).
  const syncVoice = (voice: number, channel: Channel) => {
    const on =
      channel.useSample &&
      channel.activePcm !== null &&
      channel.activeLength > 0;
    if (!on) {
      mixer.stop(voice);
      channel.voicePlay = false;
      channel.voiceQueue = false;
      channel.synthPending = false;
    } else if (channel.voicePlay) {
      const pcm = channel.activePcm!;
      const { activeLoopLength: loopLength, activeLoopStart: loopStart } =
        channel;
      if (
        loopStart > 0 &&
        channel.instrument?.kind === 'iff' &&
        validLoop(channel.activeLength, loopStart, loopLength)
      ) {
        // IFFtech starts DMA on the one-shot head and installs the loop a
        // tick later (asm lbC001990).
        mixer.play(voice, voiceSample(pcm, loopStart, 0, 0));
        mixer.queue(
          voice,
          voiceSample(pcm.subarray(loopStart), loopLength, 0, loopLength)
        );
      } else {
        mixer.play(
          voice,
          voiceSample(pcm, channel.activeLength, loopStart, loopLength)
        );
      }
      channel.voicePlay = false;
      channel.voiceQueue = false;
      channel.synthPending = false;
    } else if (channel.voiceQueue && channel.voiceQueued) {
      mixer.queue(voice, channel.voiceQueued);
      channel.voiceQueue = false;
    }
    mixer.setPitch(voice, channel.sampleHz);
    mixer.setVolume(voice, paulaVolume(channelVolume(channel)));
  };

  const resetChannel = (voice: number) => {
    mixer.stop(voice);
    const fresh = newChannel();
    const channel = channels[voice]!;
    Object.assign(channel, fresh);
  };

  // One voice's beat of the score (nuade's smus_process_channel_tick, asm
  // lbC000874-lbC000934). True once its track has ended.
  const trackBeat = (voice: number): boolean => {
    const track = tracks[voice]!;
    if (track.ended) {
      return true;
    }
    if (track.releaseWait > 0) {
      track.releaseWait--;
      if (track.releaseWait === 0 && track.plays) {
        releaseNote(voice);
      }
      return false;
    }
    if (track.noteWait > 0) {
      track.noteWait--;
      if (track.noteWait > 0) {
        return false;
      }
    }
    const data = score!.data;
    let position = track.position;
    if (position === 0 || position >= track.end) {
      track.ended = true;
      return true;
    }
    for (let guard = 256; guard > 0 && position + 2 <= track.end; guard--) {
      const word = beU16(data, position);
      position += 2;
      if (word === 0) {
        continue;
      }
      if (word === 0xff_ff) {
        track.position = position;
        track.ended = true;
        return true;
      }
      const high = word >> 8;
      const low = word & 0xff;
      if (high >= 0x82) {
        // Tempo controls, volumes and unknown commands: LoadSCORE consumes
        // them and zeroes the words.
        continue;
      }
      if (high === 0x81) {
        track.instrumentRegister = low;
        track.hasInstrument = low < 64;
        continue;
      }
      const length = NOTE_LENGTHS[low & 0x0f] ?? null;
      if (length === null) {
        continue;
      }
      track.position = position;
      const instrument = track.hasInstrument
        ? slots.get(track.instrumentRegister)
        : undefined;
      if (high === 0x80 || !track.plays || !instrument) {
        track.noteWait = length;
        return false;
      }
      // Transposed by SNX1 word 0: (word >> 4) - 8 semitones.
      const note = (i16(score!.notePitchWord) >> 4) - 8 + high;
      const velocity =
        track.playsWord === 1 ? track.baseVelocity : track.baseVelocity >> 1;
      startNote(voice, instrument, note, velocity);
      // Held for three quarters of its length, released for the rest.
      const held = (length * 0xc0_00) >>> 16;
      track.releaseWait = held;
      track.noteWait = length - held;
      return false;
    }
    if (position + 2 > track.end) {
      track.position = position;
      track.ended = true;
      return true;
    }
    return false;
  };

  const updateTempo = () => {
    if (score && score.tempoIndex !== tempoIndex) {
      tempoIndex = score.tempoIndex;
      tempo = tempoOfIndex(tempoIndex);
    }
  };

  // One timer tick (nuade's smus_process_tick, asm lbC000846): a beat of the
  // score every prescaler's worth of ticks, then every technique's tick.
  const tick = (): number => {
    channels.forEach((channel, voice) => pollVoice(voice, channel));
    let beat = true;
    if (prescaler > 0) {
      prescaler--;
      beat = prescaler === 0;
    }
    if (beat) {
      updateTempo();
      if (running && score) {
        prescaler = tempo.timerTicksPerBeat;
        let ended = 0;
        for (let voice = 0; voice < VOICES; voice++) {
          if (trackBeat(voice)) {
            ended++;
          }
        }
        if (ended === VOICES) {
          // The driver restarts the score here; the game's pieces play
          // once through, so the score stops and its notes are released.
          running = false;
          for (let voice = 0; voice < VOICES; voice++) {
            if (tracks[voice]!.hasInstrument) {
              releaseNote(voice);
            }
          }
        }
      }
    }
    channels.forEach((channel, voice) => {
      const instrument = channel.instrument;
      if (instrument?.kind === 'sampled') {
        if (channel.useSample && channel.sampleBaseHz > 0) {
          sampledPitchTick(channel, instrument);
        }
        envelopeTick(channel, instrument.envelope);
      } else if (instrument?.kind === 'synthesis') {
        envelopeTick(channel, instrument.envelope);
        synthEnvelopeTick(channel, instrument);
        synthRenderTick(voice, channel, instrument);
        synthPitchTick(channel, instrument);
      } else if (instrument?.kind === 'iff' && channel.useSample) {
        channel.sampleHz = channel.sampleBaseHz;
      }
    });
    channels.forEach((channel, voice) => syncVoice(voice, channel));
    return tempo.tickLength;
  };

  return {
    get playing() {
      return running;
    },
    releaseNote,
    startNote,
    startScore(next, instruments) {
      score = next;
      slots = instruments;
      masterVolume = next.masterVolume;
      pitchScaling = next.pitchScaling;
      tempoIndex = -1;
      prescaler = 0;
      running = true;
      for (let voice = 0; voice < VOICES; voice++) {
        resetChannel(voice);
      }
      const data = next.data;
      tracks = next.tracks.map(track => {
        // The last 0x84xx word sets the track's velocity, (low & 0x7f) x 2
        // (asm LoadSCORE 6548-6580); 0xff without one.
        let baseVelocity = 0xff;
        for (
          let at = track.start;
          at + 2 <= track.end && track.start;
          at += 2
        ) {
          const word = beU16(data, at);
          if (word === 0xff_ff) {
            break;
          }
          if (word >> 8 === 0x84) {
            baseVelocity = (word & 0x7f) * 2;
          }
        }
        return {
          baseVelocity,
          end: track.end,
          ended: false,
          hasInstrument: false,
          instrumentRegister: 0,
          noteWait: 1,
          plays: track.plays,
          playsWord: track.playsWord,
          position: track.start,
          releaseWait: 0,
          start: track.start
        };
      });
      updateTempo();
    },
    stopScore() {
      if (!running) {
        return;
      }
      running = false;
      for (let voice = 0; voice < VOICES; voice++) {
        releaseNote(voice);
      }
    },
    tick
  };
};
