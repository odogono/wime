// Decode the game's music and sound files: the Sonix scores (.smus),
// instruments (.instr) and sampled sounds (.ss) on both disks of the
// Reference Build. The game plays them with the Sonix Music Driver built
// into its code (finding:sound-game-carries-the-sonix-driver).
//
// This decodes structure only: what a score, an instrument and a sample
// hold. How they sound is the player's business (#132).
import {
  AmigaOFSImage,
  ExtractError,
  RESOURCE_FILES,
  beU16,
  beU32,
  loadLhaMember
} from './extract-graphics';

const latin1 = (data: Uint8Array): string =>
  [...data].map(byte => String.fromCharCode(byte)).join('');

const cString = (data: Uint8Array, offset: number, max: number): string => {
  const end = data.indexOf(0, offset);
  return latin1(
    data.subarray(offset, end < 0 || end > offset + max ? offset + max : end)
  );
};

// One TRAK event (finding:sound-smus-score-format).
export type ScoreEvent =
  | { duration: number; kind: 'note'; note: number }
  | { duration: number; kind: 'rest' }
  | { instrument: number; kind: 'instrument' }
  | { kind: 'tempo'; value: number }
  | { kind: 'volume'; value: number }
  | { kind: 'other'; word: number };

export type Score = {
  // The SHDR tempo word and volume byte.
  instruments: { name: string; register: number }[];
  name: string;
  // The SNX1 chunk's words: transposition, then the rest as read.
  snx1: number[];
  tempo: number;
  trackCount: number;
  tracks: ScoreEvent[][];
  volume: number;
};

// Beats for each value of a note's low nibble; null is no duration.
export const DURATIONS: readonly (number | null)[] = [
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

const decodeTrack = (data: Uint8Array): ScoreEvent[] => {
  const events: ScoreEvent[] = [];
  for (let offset = 0; offset + 2 <= data.length; offset += 2) {
    const word = beU16(data, offset);
    if (word === 0xff_ff) {
      break;
    }
    const high = word >> 8;
    const low = word & 0xff;
    if (high < 0x80 || high === 0x80) {
      const duration = DURATIONS[low & 0x0f] ?? null;
      if (duration === null) {
        events.push({ kind: 'other', word });
      } else if (high === 0x80) {
        events.push({ duration, kind: 'rest' });
      } else {
        events.push({ duration, kind: 'note', note: high });
      }
    } else if (high === 0x81) {
      events.push({ instrument: low, kind: 'instrument' });
    } else if (high === 0x82) {
      events.push({ kind: 'tempo', value: low });
    } else if (high === 0x84) {
      events.push({ kind: 'volume', value: low });
    } else {
      events.push({ kind: 'other', word });
    }
  }
  return events;
};

export const parseScore = (data: Uint8Array, file: string): Score => {
  if (
    latin1(data.subarray(0, 4)) !== 'FORM' ||
    latin1(data.subarray(8, 12)) !== 'SMUS'
  ) {
    throw new ExtractError(`${file} is not a FORM SMUS`);
  }
  const end = Math.min(data.length, 8 + beU32(data, 4));
  const score: Score = {
    instruments: [],
    name: '',
    snx1: [],
    tempo: 0,
    trackCount: 0,
    tracks: [],
    volume: 0
  };
  let sawHeader = false;
  for (let offset = 12; offset + 8 <= end;) {
    const id = latin1(data.subarray(offset, offset + 4));
    const length = beU32(data, offset + 4);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (body.length < length) {
      throw new ExtractError(`${file}: ${id} runs past the end`);
    }
    switch (id) {
      case 'SHDR':
        score.tempo = beU16(body, 0);
        score.volume = body[2]!;
        score.trackCount = body[3]!;
        sawHeader = true;
        break;
      case 'NAME':
        score.name = latin1(body);
        break;
      case 'SNX1':
        for (let i = 0; i + 2 <= body.length; i += 2) {
          score.snx1.push(beU16(body, i));
        }
        break;
      case 'INS1':
        score.instruments.push({
          name: cString(body, 4, length - 4),
          register: body[0]!
        });
        break;
      case 'TRAK':
        score.tracks.push(decodeTrack(body));
        break;
      default:
        throw new ExtractError(`${file}: unexpected ${id} chunk`);
    }
    offset += 8 + length + (length & 1);
  }
  if (!sawHeader) {
    throw new ExtractError(`${file} has no SHDR`);
  }
  return score;
};

// An instrument file: the first 0x20 bytes name its technique, empty or
// "Synthesis" for the synthesiser, or it is an IFF 8SVX sample
// (finding:sound-instrument-formats).
export type Instrument =
  | {
      // The waveform the synthesiser starts from.
      kind: 'synthesis';
      name: string;
      wave: Int8Array;
    }
  | { kind: 'sampled'; name: string; sample: string }
  | {
      // An IFF 8SVX sample: oneShot samples in the highest octave, then
      // each lower octave twice as long.
      kind: 'iff';
      octaves: number;
      oneShot: number;
      rate: number;
      repeat: number;
      samples: Int8Array;
    };

export const SYNTHESIS_SIZE = 0x1_f6;
export const SAMPLED_HEADER_SIZE = 0x60;

const parse8svx = (data: Uint8Array, file: string): Instrument => {
  if (latin1(data.subarray(8, 12)) !== '8SVX') {
    throw new ExtractError(`${file} is a FORM but not 8SVX`);
  }
  let header: Uint8Array | null = null;
  let body: Uint8Array | null = null;
  const end = Math.min(data.length, 8 + beU32(data, 4));
  for (let offset = 12; offset + 8 <= end;) {
    const id = latin1(data.subarray(offset, offset + 4));
    const length = beU32(data, offset + 4);
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    if (id === 'VHDR') {
      header = chunk;
    } else if (id === 'BODY') {
      body = chunk;
    }
    offset += 8 + length + (length & 1);
  }
  if (!header || !body) {
    throw new ExtractError(`${file}: 8SVX without VHDR and BODY`);
  }
  return {
    kind: 'iff',
    octaves: header[14]!,
    oneShot: beU32(header, 0),
    rate: beU16(header, 12),
    repeat: beU32(header, 4),
    samples: new Int8Array(body.slice().buffer)
  };
};

export const parseInstrument = (data: Uint8Array, file: string): Instrument => {
  if (latin1(data.subarray(0, 4)) === 'FORM') {
    return parse8svx(data, file);
  }
  const technique = cString(data, 0, 0x20);
  if (technique === '' || technique === 'Synthesis') {
    if (data.length !== SYNTHESIS_SIZE) {
      throw new ExtractError(
        `${file}: a synthesised instrument is ${SYNTHESIS_SIZE} bytes, not ${data.length}`
      );
    }
    return {
      kind: 'synthesis',
      name: cString(data, 0x24, 0x20),
      wave: new Int8Array(data.slice(0x44, 0x44 + 128).buffer)
    };
  }
  if (technique === 'SampledSound') {
    if (data.length < SAMPLED_HEADER_SIZE) {
      throw new ExtractError(`${file}: short SampledSound header`);
    }
    return {
      kind: 'sampled',
      name: cString(data, 0x24, 0x20),
      sample: cString(data, 0x44, 0x1c)
    };
  }
  throw new ExtractError(`${file}: unknown technique "${technique}"`);
};

// A sampled sound: one copy of the sound per octave, each twice as long
// as the one before (finding:sound-ss-sample-format).
export type SampledSound = {
  // Bytes in the lowest octave's copy, divided by 2 ** lowestOctave.
  baseLength: number;
  highestOctave: number;
  // Where the loop starts, in the same units, or null for no loop.
  loopStart: number | null;
  lowestOctave: number;
  octaves: { octave: number; samples: Int8Array }[];
};

export const SS_HEADER_SIZE = 0x3e;

export const parseSampledSound = (
  data: Uint8Array,
  file: string
): SampledSound => {
  const baseLength = beU16(data, 0);
  const loop = beU16(data, 2);
  const lowestOctave = data[4]!;
  const highestOctave = data[5]!;
  if (lowestOctave > highestOctave || highestOctave > 10) {
    throw new ExtractError(
      `${file}: octaves ${lowestOctave} to ${highestOctave}`
    );
  }
  const octaves: SampledSound['octaves'] = [];
  for (let octave = lowestOctave; octave <= highestOctave; octave++) {
    const start =
      SS_HEADER_SIZE + baseLength * (2 ** octave - 2 ** lowestOctave);
    const length = baseLength * 2 ** octave;
    if (start + length > data.length) {
      throw new ExtractError(`${file}: octave ${octave} runs past the end`);
    }
    octaves.push({
      octave,
      samples: new Int8Array(data.slice(start, start + length).buffer)
    });
  }
  return {
    baseLength,
    highestOctave,
    loopStart: loop === baseLength ? null : loop,
    lowestOctave,
    octaves
  };
};

export type SoundFiles = Map<string, Map<string, Uint8Array>>;

// Every .smus, .instr and .ss file, by disk and lower-case name.
export const loadSoundFiles = (archive: string): SoundFiles => {
  const disks: SoundFiles = new Map();
  for (const [key, [member]] of Object.entries(RESOURCE_FILES)) {
    const disk = new AmigaOFSImage(loadLhaMember(archive, member));
    const files = new Map<string, Uint8Array>();
    for (const name of [...disk.files.keys()].sort()) {
      if (/\.(smus|instr|ss)$/.test(name)) {
        files.set(name, disk.readFile(name));
      }
    }
    disks.set(key, files);
  }
  return disks;
};

// The table of pieces and sound effects in the data hunk: 36 entries of
// 0x2b bytes from data+0x43ce, each a path such as "B:Frodo.smus" or
// "A:ReverbBells" (finding:sound-score-and-effect-table). An empty entry
// is null.
export const SOUND_TABLE_OFFSET = 0x43_ce;
export const SOUND_TABLE_STRIDE = 0x2b;
export const SOUND_TABLE_ENTRIES = 36;

export type SoundTableEntry = {
  // 'disk1' for "A:", 'disk2' for "B:".
  disk: 'disk1' | 'disk2';
  // The file's lower-case name, with ".instr" added to an instrument.
  file: string;
  index: number;
  kind: 'score' | 'instrument';
  path: string;
};

export const readSoundTable = (
  dataHunk: Uint8Array
): (SoundTableEntry | null)[] =>
  Array.from({ length: SOUND_TABLE_ENTRIES }, (_, index) => {
    const path = cString(
      dataHunk,
      SOUND_TABLE_OFFSET + index * SOUND_TABLE_STRIDE,
      SOUND_TABLE_STRIDE
    );
    if (path === '') {
      return null;
    }
    const match = /^([AB]):(.+)$/.exec(path);
    if (!match) {
      throw new ExtractError(`sound table entry ${index} is "${path}"`);
    }
    const name = match[2]!.toLowerCase();
    const score = name.endsWith('.smus');
    return {
      disk: match[1] === 'A' ? 'disk1' : 'disk2',
      file: score ? name : `${name}.instr`,
      index,
      kind: score ? 'score' : 'instrument',
      path
    };
  });
