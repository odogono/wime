// The Atlas map's Force emblems (ADR-0007, docs/spec/atlas-emblems.md):
// which emblem each Force is drawn with, and the distance field atlas
// `bun run build-emblems` compiles them into.
import type { Force } from '../../sim/index';
import { NATIONS, UNIT_TYPES, unitShield } from './unit-shields';

export interface EmblemAtlas {
  // The cell's size in texels, and how much of it is margin either side
  // of the 64-unit box.
  cell: number;
  cells: Record<string, { u: number; v: number }>;
  height: number;
  margin: number;
  // Texels the field spans either side of an edge.
  radius: number;
  // Red ink, green silhouette, blue device, row by row.
  texture: Uint8Array;
  width: number;
}

// The Ring-bearer's mark, drawn over the Emblem in gold.
export const RING = 'ring';

// Each Character's silhouette, by its name in the roster
// (docs/spec/atlas-emblems.md): named Characters their own, lesser lords
// and Nazgûl one per group, unnamed Characters one per kind, and those in
// disguise as they appear. Any Character not named here stands on the
// plain banner.
const CHARACTERS: Record<string, string> = {
  ARAGORN: 'aragorn',
  BILBO: 'bilbo',
  BOROMIR: 'boromir',
  BRAND: 'brand',
  CELEBORN: 'celeborn',
  CIRDAN: 'cirdan',
  DAIN: 'dain',
  DENETHOR: 'denethor',
  DERNHELM: 'dernhelm',
  DERVORIN: 'gondor-lord',
  DUINHIR: 'gondor-lord',
  DUNHERE: 'rohan-lord',
  ELFHELM: 'rohan-lord',
  ELROND: 'elrond',
  EOMER: 'eomer',
  ERKENBRAND: 'rohan-lord',
  FARAMIR: 'faramir',
  FORLONG: 'gondor-lord',
  FRODO: 'frodo',
  GALADRIEL: 'galadriel',
  GANDALF: 'gandalf',
  // Gandalf the White: a silhouette cannot show his robe turn white.
  'a balrog': 'balrog',
  'a dwarf': 'dwarf',
  'a hobbit': 'hobbit',
  'an elf': 'elf',
  'an old man': 'old-man',
  'a Ranger': 'ranger',
  'a spider': 'spider',
  'a traveler': 'traveler',
  'a troll': 'troll',
  'a wanderer': 'wanderer',
  'a wight': 'wight',
  "GANDALF'": 'gandalf',
  GIMLI: 'gimli',
  GLORFINDEL: 'glorfindel',
  GOLASGIL: 'gondor-lord',
  GOLLUM: 'gollum',
  GOTHMOG: 'gothmog',
  GRIMBOLD: 'rohan-lord',
  HIRLUIN: 'gondor-lord',
  IMRAHIL: 'imrahil',
  LEGOLAS: 'legolas',
  MERRY: 'merry',
  PIPPIN: 'pippin',
  RADAGAST: 'radagast',
  SAM: 'sam',
  SARUMAN: 'saruman',
  SAURON: 'sauron',
  Shelob: 'shelob',
  'the 2nd NAZGUL': 'nazgul',
  'the 3rd NAZGUL': 'nazgul',
  'the 4th NAZGUL': 'nazgul',
  'the 5th NAZGUL': 'nazgul',
  'the 6th NAZGUL': 'nazgul',
  'the 7th NAZGUL': 'nazgul',
  'the 8th NAZGUL': 'nazgul',
  'the 9th NAZGUL': 'nazgul',
  'the NAZGUL LORD': 'witch-king',
  THEODEN: 'theoden',
  THEODRED: 'rohan-lord',
  THRANDUIL: 'thranduil',
  'TOM BOMBADIL': 'bombadil',
  TREEBEARD: 'treebeard'
};

// One picture of an Emblem: an atlas cell drawn into a square at (x, y),
// `size` across, as fractions of the Emblem's box.
export interface EmblemLayer {
  name: string;
  size: number;
  x: number;
  y: number;
}

const whole = (name: string): EmblemLayer => ({ name, size: 1, x: 0, y: 0 });

// Where a Unit's device and mark lie on each shield, in units of the
// 64-unit box: the device filling the shield, and over it, as on the
// original's Badges, the weapon across the lower right, past the rim. The
// cavalry's horse's head stands upright in the lower right.
const MARK = { size: 42, x: 21, y: 21 };
const HORSE = { size: 30, x: 33, y: 31 };
const SHIELD_LAYOUT = {
  heraldic: { device: { size: 36, x: 14, y: 13 }, outline: 'shield' },
  round: { device: { size: 36, x: 14, y: 15 }, outline: 'round-shield' }
} as const;

const at = (
  name: string,
  { size, x, y }: { size: number; x: number; y: number }
): EmblemLayer => ({ name, size: size / 64, x: x / 64, y: y / 64 });

// What an Emblem is drawn from, outline first: the Compact marker draws
// the outline alone.
export const emblemLayers = (force: Force): EmblemLayer[] => {
  if (!force.leader.isUnit) {
    return [whole(CHARACTERS[force.leader.name] ?? 'banner')];
  }
  const shield = unitShield(force.leader);
  if (!shield) {
    return [whole('round-shield')];
  }
  const layout = SHIELD_LAYOUT[shield.elite ? 'heraldic' : 'round'];
  return [
    whole(layout.outline),
    at(`device-${shield.nation}`, layout.device),
    ...(shield.type
      ? [at(`mark-${shield.type}`, shield.type === 'cavalry' ? HORSE : MARK)]
      : [])
  ];
};

// Every emblem a Force can be drawn with.
export const EMBLEMS: readonly string[] = [
  ...new Set([
    'banner',
    'shield',
    'round-shield',
    RING,
    ...Object.values(CHARACTERS),
    ...NATIONS.map(n => `device-${n}`),
    ...UNIT_TYPES.map(t => `mark-${t}`)
  ])
];

export const loadEmblemAtlas = async (base: string): Promise<EmblemAtlas> => {
  const [atlas, data] = await Promise.all([
    fetch(`${base}emblems/atlas.json`).then(async r => {
      if (!r.ok) {
        throw new Error(`No emblem atlas: run bun run build-emblems`);
      }
      return (await r.json()) as Omit<EmblemAtlas, 'texture'>;
    }),
    fetch(`${base}emblems/atlas.bin`).then(async r => {
      if (!r.ok) {
        throw new Error(`No emblem atlas: run bun run build-emblems`);
      }
      // Gzipped by build-emblems: the field compresses well.
      const raw = r.body!.pipeThrough(new DecompressionStream('gzip'));
      return new Uint8Array(await new Response(raw).arrayBuffer());
    })
  ]);
  if (data.length !== atlas.width * atlas.height * 3) {
    throw new Error('The emblem atlas is the wrong size');
  }
  return { ...atlas, texture: data };
};
