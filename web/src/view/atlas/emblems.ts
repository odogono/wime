// The Atlas map's Force emblems (ADR-0007, docs/spec/atlas-emblems.md):
// which emblem each Force is drawn with, and the distance field atlas
// `bun run build-emblems` compiles them into.
import type { Force } from '../../sim/index';

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

// Units' shields by name, until they are composed from Nation and Unit
// Type (#301).
const UNITS: Record<string, string> = {
  'Rohirrim scouts': 'rohan-cavalry'
};

// Every emblem a Force can be drawn with.
export const EMBLEMS: readonly string[] = [
  ...new Set([
    'banner',
    'shield',
    RING,
    ...Object.values(CHARACTERS),
    ...Object.values(UNITS)
  ])
];

export const emblemFor = (force: Force): string =>
  force.leader.isUnit
    ? (UNITS[force.leader.name] ?? 'shield')
    : (CHARACTERS[force.leader.name] ?? 'banner');

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
