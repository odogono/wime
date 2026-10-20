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

// Reading a Sonix SMUS score: SHDR, NAME, SNX1, INS1 and TRAK chunks
// (finding:sound-smus-score-format; nuade's parse_smus, asm LoadSCORE).
import { beU16, beU32, tempoIndexOfWord } from './tables';

export const VOICES = 4;

export type SonixScore = {
  data: Uint8Array;
  // Register number to instrument name, from the INS1 chunks.
  instruments: Map<number, string>;
  // The score's master volume, 0(A6): the SHDR volume byte, doubled when
  // below 0x80.
  masterVolume: number;
  name: string;
  // SNX1 word 0: notes play at (word >> 4) - 8 + their pitch.
  notePitchWord: number;
  // SNX1 word 1, 4(A6): scales sampled and synthesised periods by
  // (0x1080 - it) / 0x1000.
  pitchScaling: number;
  // The tempo table byte index worked out from the SHDR tempo word.
  tempoIndex: number;
  // Per voice: the TRAK's byte range in data (0, 0 for none), whether the
  // SNX1 longword says the voice plays notes, and that longword's low word
  // (notes play at half velocity unless it is 1).
  tracks: { end: number; plays: boolean; playsWord: number; start: number }[];
  // The SHDR volume byte as LoadSCORE keeps it (doubled below 0x80), which
  // also sets the timer before the first tick.
  volumeByte: number;
};

const latin1 = (data: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...data.subarray(offset, offset + length));

export class SonixScoreError extends Error {}

const chunkAdvance = (length: number): number => 8 + length + (length & 1);

export const parseScore = (data: Uint8Array): SonixScore => {
  if (
    data.length < 24 ||
    latin1(data, 0, 4) !== 'FORM' ||
    latin1(data, 8, 4) !== 'SMUS'
  ) {
    throw new SonixScoreError('not a FORM SMUS score');
  }
  if (latin1(data, 12, 4) !== 'SHDR' || beU32(data, 16) < 4 || !data[23]) {
    throw new SonixScoreError('invalid SHDR');
  }
  const volumeByte = data[22]!;
  const score: SonixScore = {
    data,
    instruments: new Map(),
    masterVolume: volumeByte < 0x80 ? volumeByte << 1 : volumeByte,
    name: '',
    notePitchWord: 0x80,
    pitchScaling: 0x80,
    tempoIndex: tempoIndexOfWord(beU16(data, 20)),
    tracks: [],
    volumeByte: volumeByte < 0x80 ? volumeByte << 1 : volumeByte
  };
  let offset = 24;
  if (offset + 8 <= data.length && latin1(data, offset, 4) === 'NAME') {
    const length = beU32(data, offset + 4);
    score.name = latin1(data, offset + 8, length).replace(/\0.*$/s, '');
    offset += chunkAdvance(length);
  }
  if (offset + 8 > data.length || latin1(data, offset, 4) !== 'SNX1') {
    throw new SonixScoreError('missing SNX1 chunk');
  }
  const snx1 = offset + 8;
  const snx1Length = beU32(data, offset + 4);
  if (snx1Length >= 2) {
    score.notePitchWord = beU16(data, snx1);
  }
  if (snx1Length >= 4) {
    score.pitchScaling = beU16(data, snx1 + 2);
  }
  const plays = Array.from({ length: VOICES }, (_, voice) => {
    const at = 8 + voice * 4;
    return at + 4 <= snx1Length
      ? {
          plays: beU32(data, snx1 + at) !== 0,
          playsWord: beU16(data, snx1 + at + 2)
        }
      : { plays: false, playsWord: 0 };
  });
  offset += chunkAdvance(snx1Length);
  const tracks: { end: number; start: number }[] = [];
  while (offset + 8 <= data.length) {
    const id = latin1(data, offset, 4);
    const length = beU32(data, offset + 4);
    if (offset + chunkAdvance(length) > data.length) {
      throw new SonixScoreError('truncated chunk');
    }
    if (id === 'INS1') {
      const register = data[offset + 8]!;
      if (length < 2 || register > 63 || data[offset + 9] !== 0) {
        throw new SonixScoreError('invalid INS1');
      }
      const name = latin1(data, offset + 12, Math.max(0, length - 4));
      score.instruments.set(register, name.replace(/\0.*$/s, '').slice(0, 63));
    } else if (id === 'TRAK' && tracks.length < VOICES && length > 0) {
      tracks.push({ end: offset + 8 + length, start: offset + 8 });
    }
    offset += chunkAdvance(length);
  }
  if (tracks.length === 0) {
    throw new SonixScoreError('no TRAK chunks');
  }
  score.tracks = plays.map((play, voice) => ({
    ...play,
    ...(tracks[voice] ?? { end: 0, start: 0 })
  }));
  return score;
};
