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

// The driver's tables and clocks, and the 68000 integer widths its maths
// wraps at. The tables are in the game's code byte for byte
// (finding:sound-game-carries-the-sonix-driver).

// 68000 register widths: the driver's arithmetic wraps at these.
export const u16 = (value: number): number => value & 0xff_ff;
export const i16 = (value: number): number => (value << 16) >> 16;
export const i8 = (value: number): number => (value << 24) >> 24;

export const beU16 = (data: Uint8Array, offset: number): number =>
  ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
export const beU32 = (data: Uint8Array, offset: number): number =>
  beU16(data, offset) * 0x1_00_00 + beU16(data, offset + 2);

// The PAL Paula colour clock in Hz: a period register counts its ticks
// (nuade's NUADE_PAULA_CLOCK_PAL).
export const PAULA_CLOCK_PAL = 3_546_895;

// The PAL CIA timer clock that tick lengths are counted in (SONIX_CIA_PAL_HZ).
export const CIA_CLOCK_PAL = 709_379;

// The 12 semitone ratios, unison 0x8000 down to 0x43ce (code+0x19a4a).
export const SEMITONE_RATIOS: readonly number[] = [
  0x80_00, 0x78_d1, 0x72_09, 0x6b_a2, 0x65_98, 0x5f_e4, 0x5a_82, 0x55_6e,
  0x50_a3, 0x4c_1c, 0x47_d6, 0x43_ce
];

export const semitoneRatio = (semitone: number): number =>
  SEMITONE_RATIOS[semitone] ?? 0x80_00;

// The 128-entry tempo table (code+0x19a64; nuade's smus_tempo_table). The top
// 4 bits of an entry are timer ticks per beat, the rest the timer divisor.
export const TEMPO_TABLE: readonly number[] = [
  0xfa_83, 0xf5_25, 0xef_e4, 0xea_c0, 0xe5_b9, 0xe0_cc, 0xdb_fb, 0xd7_44,
  0xd2_a8, 0xce_24, 0xc9_b9, 0xc5_67, 0xc1_2c, 0xbd_08, 0xb8_fb, 0xb5_04,
  0xb1_23, 0xad_58, 0xa9_a1, 0xa5_fe, 0xa2_70, 0x9e_f5, 0x9b_8d, 0x98_37,
  0x94_f4, 0x91_c3, 0x8e_a4, 0x8b_95, 0x88_98, 0x85_aa, 0x82_cd, 0x80_00,
  0x7d_41, 0x7a_92, 0x77_f2, 0x75_60, 0x72_dc, 0x70_66, 0x6d_fd, 0x6b_a2,
  0x69_54, 0x67_12, 0x64_dc, 0x62_b3, 0x60_96, 0x5e_84, 0x5c_7d, 0x5a_82,
  0x58_91, 0x56_ac, 0x54_d0, 0x52_ff, 0x51_38, 0x4f_7a, 0x4d_c6, 0x4c_1b,
  0x4a_7a, 0x48_e1, 0x47_52, 0x45_ca, 0x44_4c, 0x42_d5, 0x41_66, 0x40_00,
  0x3e_a0, 0x3d_49, 0x3b_f9, 0x3a_b0, 0x39_6e, 0x38_33, 0x36_fe, 0x35_d1,
  0x34_aa, 0x33_89, 0x32_6e, 0x31_59, 0x30_4b, 0x2f_42, 0x2e_3e, 0x2d_41,
  0x2c_48, 0x2b_56, 0x2a_68, 0x29_7f, 0x28_9c, 0x27_bd, 0x26_e3, 0x26_0d,
  0x25_3d, 0x24_70, 0x23_a9, 0x22_e5, 0x22_26, 0x21_6a, 0x20_b3, 0x20_00,
  0x1f_50, 0x1e_a4, 0x1d_fc, 0x1d_58, 0x1c_b7, 0x1c_19, 0x1b_7f, 0x1a_e8,
  0x1a_55, 0x19_c4, 0x19_37, 0x18_ac, 0x18_25, 0x17_a1, 0x17_1f, 0x16_a0,
  0x16_24, 0x15_ab, 0x15_34, 0x14_bf, 0x14_4e, 0x13_de, 0x13_71, 0x13_06,
  0x12_9e, 0x12_38, 0x11_d4, 0x11_72, 0x11_13, 0x10_b5, 0x10_59, 0x10_00
];

// Beats for each value of a TRAK word's low nibble (code+0x19580); null is
// no length, a word the driver drops (finding:sound-smus-score-format).
export const NOTE_LENGTHS: readonly (number | null)[] = [
  32,
  16,
  8,
  4,
  2,
  null,
  null,
  null,
  48,
  24,
  12,
  6,
  3,
  null,
  null,
  null
];

// The tempo table's byte index for an SHDR tempo word, as LoadSCORE works it
// out: 0xe100000 / word, then the first entry at or below that (nuade's
// compute_smus_pitch_offset, asm LoadSCORE 6463-6479).
export const tempoIndexOfWord = (word: number): number => {
  if (word < 0x0e_11) {
    return 0;
  }
  const quotient = u16(Math.floor(0x0e_10_00_00 / word));
  for (let index = 0; index < 256; index += 2) {
    if ((TEMPO_TABLE[index / 2] ?? 0) <= quotient) {
      return index;
    }
  }
  return 255;
};

export type Tempo = {
  // CIA cycles from one timer tick to the next.
  tickLength: number;
  // The driver's $36(A6): what envelopes, slides and ramps scale by.
  ticksPerBeat: number;
  // Timer ticks to a beat of the score (the prescaler's reload).
  timerTicksPerBeat: number;
};

// A tempo table byte index's timing (nuade's smus_update_tempo, asm lbC0007F2
// 6845-6881). A CIA timer loaded with N counts N + 1 cycles.
export const tempoOfIndex = (byteIndex: number): Tempo => {
  const index = Math.min(byteIndex >> 1, 127);
  const entry = TEMPO_TABLE[index] ?? 0x10_00;
  const timerTicksPerBeat = entry >> 12 || 1;
  const divisor = u16(timerTicksPerBeat << 12) || 1;
  const ticksPerBeat = u16(Math.floor((entry * 0x1_00_00) / 2 / divisor));
  const timer = (ticksPerBeat * 0x2e_9c) >>> 15 || 1;
  return { tickLength: timer + 1, ticksPerBeat, timerTicksPerBeat };
};

// The timing before any score sets one: the driver's default tempo byte 0xa5
// through InitSound's CIA maths (nuade's snx_update_tick_timing with
// SNX's default). Provisional: what the game's timer holds before its first
// score is not traced.
export const DEFAULT_TEMPO: Tempo = (() => {
  const clock = Math.floor(CIA_CLOCK_PAL / 50) * 125;
  const tempo = 0xa5;
  return {
    tickLength: Math.floor(clock / tempo) + 1,
    ticksPerBeat: u16(Math.floor(0x4b_00_00 / tempo)),
    timerTicksPerBeat: 1
  };
})();

// The tick before a score's first: PlaySCORE's timer still runs at the rate
// set from the SHDR volume byte (nuade's snx_reset_runtime, whose first tick
// only waits).
export const firstTickLength = (volumeByte: number): number => {
  const clock = Math.floor(CIA_CLOCK_PAL / 50) * 125;
  return Math.floor(clock / (volumeByte || 0xa5)) + 1;
};

// A synthesised note's period before it is halved into Paula's range: note
// 36 to 107, 0xd5c8 x ratio >> (octave + 17) (asm lbC01EC82).
export const synthPeriod = (note: number): number => {
  const relative = Math.max(0, Math.min(71, note - 36));
  return (
    (0xd5_c8 * semitoneRatio(relative % 12)) >>>
    (Math.floor(relative / 12) + 17)
  );
};

// A sampled note's Paula period on the score engine: base 0xd5c8 x ratio >>
// 15, scaled by (0x1080 - pitch scaling) >> 19 (asm 8543-8570, 8621-8626;
// finding:sound-ss-sample-format).
export const sampledBasePeriod = (semitone: number): number =>
  u16((0xd5_c8 * semitoneRatio(semitone)) >>> 15);

export const sampledPeriod = (semitone: number, pitchScaling: number): number =>
  ((0x10_80 - pitchScaling) * sampledBasePeriod(semitone)) >>> 19;
