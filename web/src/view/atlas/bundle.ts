// Reads the compiled geography bundle that tools/build-geography.ts
// writes (ADR-0006): a u32 header length, the JSON header, then binary
// sections whose layouts that tool documents.

export interface Section {
  bytes: Uint8Array;
  count: number;
}

// A line point's style that ends a run of line (tools/build-geography.ts).
export const NO_SEGMENT = 255;

type SectionName =
  'fillIndices' | 'fillVertices' | 'linePoints' | 'relief' | 'symbols';

export interface GeographyBundle extends Record<SectionName, Section> {
  bounds: [number, number, number, number];
  fillChunks: { firstIndex: number; firstVertex: number }[];
  // Map coordinates are stored multiplied by this.
  fixedPoint: number;
  lineStyles: string[];
  // Each Place's picture, an index into `pictograms`.
  pictograms: string[];
  places: {
    name: string;
    pictogram: number;
    rank: number;
    x: number;
    y: number;
  }[];
  regionKinds: string[];
  regionLabels: { name: string; rank: number; x: number; y: number }[];
  // The relief section's grid: width by height cells, each step map
  // pixels square.
  reliefGrid: { height: number; step: number; width: number };
  symbolKinds: string[];
}

const BYTES: Record<SectionName, number> = {
  fillIndices: 2,
  fillVertices: 6,
  linePoints: 12,
  relief: 1,
  symbols: 8
};

export const parseBundle = (buffer: ArrayBuffer): GeographyBundle => {
  const headerBytes = new DataView(buffer).getUint32(0, true);
  const header = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 4, headerBytes))
  ) as Omit<GeographyBundle, SectionName | 'reliefGrid'> & {
    relief: GeographyBundle['reliefGrid'];
    sections: Record<SectionName, { count: number; offset: number }>;
    version: number;
  };
  if (header.version !== 3) {
    throw new Error(
      `geography bundle version ${header.version} is not supported; run \`bun run build-geography\``
    );
  }
  const section = (name: SectionName): Section => {
    const { count, offset } = header.sections[name];
    return {
      bytes: new Uint8Array(
        buffer,
        4 + headerBytes + offset,
        count * BYTES[name]
      ),
      count
    };
  };
  return {
    bounds: header.bounds,
    fillChunks: header.fillChunks,
    fillIndices: section('fillIndices'),
    fillVertices: section('fillVertices'),
    fixedPoint: header.fixedPoint,
    linePoints: section('linePoints'),
    lineStyles: header.lineStyles,
    pictograms: header.pictograms,
    places: header.places,
    regionKinds: header.regionKinds,
    regionLabels: header.regionLabels,
    relief: section('relief'),
    reliefGrid: header.relief,
    symbolKinds: header.symbolKinds,
    symbols: section('symbols')
  };
};

export const loadBundle = async (url: string): Promise<GeographyBundle> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `${url}: ${response.status}; run \`bun run build-geography\``
    );
  }
  return parseBundle(await response.arrayBuffer());
};
