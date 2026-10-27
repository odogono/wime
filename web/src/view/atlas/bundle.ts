// Reads the compiled geography bundle that tools/build-geography.ts
// writes (ADR-0006): a u32 header length, the JSON header, then Float32
// sections.

export interface Section {
  count: number;
  data: Float32Array;
  stride: number;
}

export interface GeographyBundle {
  bounds: [number, number, number, number];
  fill: Section;
  lines: Section;
  lineStyles: string[];
  places: { name: string; rank: number; x: number; y: number }[];
  regionKinds: string[];
  regionLabels: { name: string; rank: number; x: number; y: number }[];
  symbolKinds: string[];
  symbols: Section;
}

type SectionName = 'fill' | 'lines' | 'symbols';

export const parseBundle = (buffer: ArrayBuffer): GeographyBundle => {
  const headerBytes = new DataView(buffer).getUint32(0, true);
  const header = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 4, headerBytes))
  ) as Omit<GeographyBundle, SectionName> & {
    sections: Record<
      SectionName,
      { count: number; offset: number; stride: number }
    >;
    version: number;
  };
  if (header.version !== 1) {
    throw new Error(
      `geography bundle version ${header.version} is not supported`
    );
  }
  const section = (name: SectionName): Section => {
    const { count, offset, stride } = header.sections[name];
    return {
      count,
      data: new Float32Array(buffer, 4 + headerBytes + offset, count * stride),
      stride
    };
  };
  return {
    bounds: header.bounds,
    fill: section('fill'),
    lines: section('lines'),
    lineStyles: header.lineStyles,
    places: header.places,
    regionKinds: header.regionKinds,
    regionLabels: header.regionLabels,
    symbolKinds: header.symbolKinds,
    symbols: section('symbols')
  };
};

export const loadBundle = async (url: string): Promise<GeographyBundle> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `${url}: ${response.status}; run \`bun tools/build-geography.ts\``
    );
  }
  return parseBundle(await response.arrayBuffer());
};
