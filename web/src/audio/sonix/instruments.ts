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

// Instrument files and the three techniques the game uses to play them
// (finding:sound-instrument-formats): Synthesis, SampledSound (with its .ss
// sample) and IFF 8SVX. Follows nuade's sonix_io.c loader; nuade's AIFF and
// TINY paths are left out, as the game has neither.
import { buildFilterBank } from './synth';
import { beU16, beU32 } from './tables';

// Resolve an instrument or sample file by name on the disk the score came
// from, such as 'piano.instr' or 'piano.ss'. Case-insensitive; undefined when
// missing, and the instrument is then silent, as the original's loader leaves
// it unloaded.
export type SonixFiles = (fileName: string) => Uint8Array | undefined;

// One stretch of a multi-octave sample: the notes it plays and its loop.
export type SampleZone = {
  highNote: number;
  loopLength: number;
  loopStart: number;
  lowNote: number;
  samples: Int8Array;
};

// The four-stage volume envelope of SampledSound and Synthesis instruments:
// a target and a speed word for attack, decay, sustain and release.
export type Envelope = {
  speeds: readonly number[];
  targets: readonly number[];
};

export type SynthesisInstrument = {
  // Blend (c2) and ring-modulation (c4) rates (0x1e2, 0x1e4).
  blendRate: number;
  envelope: Envelope;
  // The modulation envelope: 256 signed bytes from 0xc4 (nuade reads past the
  // 64-byte second waveform into the fields after it, as the driver does).
  envelopeDelay: number;
  envelopeLoop: number;
  envelopePitch: number;
  envelopeRate: number;
  envelopeTable: Int8Array;
  envelopeVolume: number;
  // The 64 filtered copies of the waveform, 128 bytes each.
  filterBank: Int8Array;
  filterBase: number;
  filterEnvelope: number;
  filterRange: number;
  kind: 'synthesis';
  name: string;
  // The byte the driver reads just past a band's end on the last band: the
  // next synthesised instrument's first filtered byte, as the loader packs
  // their banks back to back (asm `add.l #8192,D5`), else 0.
  nextBankByte: number;
  portamento: boolean;
  ringRate: number;
  slideRate: number;
  volume: number;
  wave: Int8Array;
};

export type SampledInstrument = {
  envelope: Envelope;
  kind: 'sampled';
  name: string;
  vibratoDelay: number;
  vibratoDepth: number;
  vibratoSpeed: number;
  volume: number;
  // Empty when the .ss file's octave range is empty: every note is dropped.
  zones: SampleZone[];
};

export type IffInstrument = {
  kind: 'iff';
  name: string;
  // The VHDR volume, 0x10000 for full.
  volume: number;
  zones: SampleZone[];
};

export type SonixInstrument =
  IffInstrument | SampledInstrument | SynthesisInstrument;

const SYNTHESIS_SIZE = 0x1_f6;
const SS_HEADER_SIZE = 0x3e;

const latin1 = (data: Uint8Array): string =>
  [...data].map(byte => String.fromCharCode(byte)).join('');

// A printable C string of at most `max` bytes (nuade's read_cstr).
const cString = (data: Uint8Array, offset: number, max: number): string => {
  let text = '';
  for (
    let index = offset;
    index < offset + max && index < data.length;
    index++
  ) {
    const byte = data[index]!;
    if (byte < 32 || byte > 126) {
      break;
    }
    text += String.fromCharCode(byte);
  }
  return text;
};

const words = (data: Uint8Array, offset: number, count: number): number[] =>
  Array.from({ length: count }, (_, index) => beU16(data, offset + index * 2));

const asInt8 = (data: Uint8Array): Int8Array =>
  new Int8Array(data.buffer, data.byteOffset, data.length);

// A synthesised instrument: a 502-byte file whose first 0x20 bytes are empty
// or "Synthesis" (code+0x18f80; finding:sound-synthesis-instrument-fields,
// whose fields past the waveform follow nuade and are not traced).
const loadSynthesis = (
  data: Uint8Array,
  name: string
): SynthesisInstrument | undefined => {
  const named = latin1(data.subarray(0, 9)) === 'Synthesis';
  const empty = data.subarray(0, 32).every(byte => byte === 0);
  if ((!named && !empty) || data.length < SYNTHESIS_SIZE) {
    return undefined;
  }
  const wave = asInt8(data.slice(0x44, 0x44 + 128));
  return {
    blendRate: beU16(data, 0x1_e2),
    envelope: {
      speeds: words(data, 0x1_ee, 4),
      targets: words(data, 0x1_e6, 4)
    },
    envelopeDelay: beU16(data, 0x1_e0),
    envelopeLoop: (beU16(data, 0x1_de) << 16) >> 16,
    envelopePitch: beU16(data, 0x1_d4),
    envelopeRate: beU16(data, 0x1_dc),
    envelopeTable: asInt8(data.slice(0xc4, 0xc4 + 256)),
    envelopeVolume: beU16(data, 0x1_d0),
    filterBank: buildFilterBank(wave),
    filterBase: beU16(data, 0x1_d6),
    filterEnvelope: beU16(data, 0x1_da),
    filterRange: beU16(data, 0x1_d8),
    kind: 'synthesis',
    name,
    nextBankByte: 0,
    portamento: beU16(data, 0x1_ce) !== 0,
    ringRate: beU16(data, 0x1_e4),
    slideRate: beU16(data, 0x1_d2),
    volume: beU16(data, 0x1_cc),
    wave
  };
};

// An IFF 8SVX sample with one copy per octave (nuade's decode_8svx_zones).
const loadIff = (data: Uint8Array, name: string): IffInstrument | undefined => {
  if (
    data.length < 12 ||
    latin1(data.subarray(0, 4)) !== 'FORM' ||
    latin1(data.subarray(8, 12)) !== '8SVX'
  ) {
    return undefined;
  }
  const end = Math.min(data.length, 8 + beU32(data, 4));
  let header: Uint8Array | undefined;
  let body: Uint8Array | undefined;
  for (let offset = 12; offset + 8 <= end;) {
    const id = latin1(data.subarray(offset, offset + 4));
    const length = beU32(data, offset + 4);
    const chunkEnd = Math.min(end, offset + 8 + length);
    if (id === 'VHDR' && chunkEnd - offset - 8 >= 20) {
      header = data.subarray(offset + 8, chunkEnd);
    } else if (id === 'BODY') {
      body = data.subarray(offset + 8, chunkEnd);
    }
    if (chunkEnd === end) {
      break;
    }
    offset = chunkEnd + (length & 1);
  }
  if (!header || !body || body.length === 0 || header[15] !== 0) {
    return undefined;
  }
  const oneShot = beU32(header, 0);
  const repeat = beU32(header, 4);
  const octaves = header[14] || 1;
  // How many octaves the stored copies sit below the top one, from the
  // lengths' trailing zero bits (nuade's octave_shift loop).
  let shift = 0;
  {
    let a = oneShot;
    let b = repeat;
    let c = beU32(header, 8);
    for (;;) {
      a = Math.floor(a / 2);
      b = Math.floor(b / 2);
      c = Math.floor(c / 2);
      shift++;
      if ((a | b) & 1 || c === 1 || ((shift + octaves) & 0xff) >= 8) {
        break;
      }
    }
  }
  const zones: SampleZone[] = [];
  for (let octave = 0; octave < octaves && zones.length < 8; octave++) {
    const base = (10 - shift - octave) * 12;
    if (base + 11 < 0 || base > 127) {
      continue;
    }
    let length = oneShot * 2 ** octave;
    let offset = oneShot * (2 ** octave - 1);
    if (offset + length > body.length) {
      continue;
    }
    let loopStart = 0;
    let loopLength = 0;
    if (repeat > 0) {
      loopStart = oneShot * 2 ** octave;
      loopLength = repeat * 2 ** octave;
      const looped = (oneShot + repeat) * 2 ** octave;
      const loopedOffset = (oneShot + repeat) * (2 ** octave - 1);
      if (loopedOffset + looped <= body.length) {
        length = looped;
        offset = loopedOffset;
      }
    }
    zones.push({
      highNote: Math.min(127, base + 11),
      ...validLoop(length, loopStart, loopLength),
      lowNote: Math.max(0, base),
      samples: asInt8(body.subarray(offset, offset + length))
    });
  }
  if (zones.length === 0) {
    return undefined;
  }
  return { kind: 'iff', name, volume: beU32(header, 16), zones };
};

// A loop that does not fit is no loop (nuade's sonix_song_add_instrument_zone).
const validLoop = (
  length: number,
  loopStart: number,
  loopLength: number
): { loopLength: number; loopStart: number } =>
  loopLength > 1 && loopStart < length && loopLength <= length - loopStart
    ? { loopLength, loopStart }
    : { loopLength: 0, loopStart: 0 };

// The octaves of a .ss sample (finding:sound-ss-sample-format): word 0 is the
// base length L, word 2 the loop start in the same units, bytes 4 and 5 the
// lowest and highest octave; octave k is L x 2^k bytes from 0x3e on, and
// plays notes (10 - k) x 12 to that + 11. A copy that runs past the file's
// end is padded with silence (on the Amiga it ran into the next file).
const sampleZones = (data: Uint8Array): SampleZone[] | undefined => {
  if (data.length < SS_HEADER_SIZE) {
    return undefined;
  }
  const baseLength = beU16(data, 0);
  const loop = beU16(data, 2);
  // The range check compares the octave bytes as signed (asm lbC00DB52).
  const lowest = (data[4]! << 24) >> 24;
  const highest = (data[5]! << 24) >> 24;
  if (baseLength === 0 || highest > 10 || (lowest < 0 && lowest <= highest)) {
    return undefined;
  }
  const zones: SampleZone[] = [];
  let offset = SS_HEADER_SIZE;
  for (let octave = lowest; octave <= highest; octave++) {
    if (offset >= data.length) {
      break;
    }
    const length = baseLength * 2 ** octave;
    const loopStart = loop * 2 ** octave;
    const samples = new Int8Array(length);
    samples.set(asInt8(data.subarray(offset, offset + length)));
    const low = (10 - octave) * 12;
    zones.push({
      highNote: Math.min(127, low + 11),
      ...validLoop(length, loopStart, length - loopStart),
      lowNote: Math.max(0, low),
      samples
    });
    offset += length;
  }
  return zones;
};

// A SampledSound instrument: a header naming its .ss sample at 0x44, with
// the volume at 0x68, the envelope at 0x6a and the vibrato at 0x7a (nuade's
// loader; code+0x1a168).
const loadSampled = (
  data: Uint8Array,
  name: string,
  files: SonixFiles
): SampledInstrument | undefined => {
  if (cString(data, 0, 32) !== 'SampledSound') {
    return undefined;
  }
  const sample = cString(data, 0x44, 32) || name;
  const ss = files(`${sample}.ss`) ?? files(`${name}.ss`);
  if (!ss || latin1(ss.subarray(0, 4)) === 'FORM') {
    // nuade also takes an IFF .ss; the game has none.
    return undefined;
  }
  const zones = sampleZones(ss);
  if (!zones) {
    return undefined;
  }
  const long = data.length >= 0x80;
  return {
    envelope: { speeds: words(data, 0x72, 4), targets: words(data, 0x6a, 4) },
    kind: 'sampled',
    name,
    vibratoDelay: long ? beU16(data, 0x7e) : 0,
    vibratoDepth: long ? beU16(data, 0x7a) : 0,
    vibratoSpeed: long ? beU16(data, 0x7c) : 0,
    volume: beU16(data, 0x68),
    zones
  };
};

// Load `<name>.instr` and what it plays, trying the techniques in the
// loader's order. Undefined when the file or its sample is missing or not
// one of the game's kinds.
export const loadInstrument = (
  name: string,
  files: SonixFiles
): SonixInstrument | undefined => {
  const base = name.replace(/\.instr$/i, '');
  const data = files(`${base}.instr`);
  if (!data) {
    return undefined;
  }
  return (
    loadSynthesis(data, base) ??
    loadIff(data, base) ??
    (data.length >= 0x7a ? loadSampled(data, base, files) : undefined)
  );
};
