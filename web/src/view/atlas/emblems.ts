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

// Emblems drawn for a Leader's name. Every other Character stands on the
// plain banner and every other Unit on the plain shield, until the Unit
// shields (#301) and Character figures (#302) are drawn.
const BY_NAME: Record<string, string> = {
  ARAGORN: 'aragorn',
  'Rohirrim scouts': 'rohan-cavalry'
};

export const emblemFor = (force: Force): string =>
  BY_NAME[force.leader.name] ?? (force.leader.isUnit ? 'shield' : 'banner');

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
      return new Uint8Array(await r.arrayBuffer());
    })
  ]);
  if (data.length !== atlas.width * atlas.height * 3) {
    throw new Error('The emblem atlas is the wrong size');
  }
  return { ...atlas, texture: data };
};
