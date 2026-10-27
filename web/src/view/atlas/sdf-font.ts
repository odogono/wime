// A signed distance field font, made at load time from a system serif
// face, so labels stay sharp at any zoom (ADR-0006).

export interface Glyph {
  advance: number;
  // The glyph's cell in the atlas, in texels.
  u: number;
  v: number;
}

export interface SdfFont {
  // Ascent and cell size in font pixels at `size`.
  cell: number;
  glyphs: Map<string, Glyph>;
  // Distance in font pixels that the field spans either side of an edge.
  radius: number;
  size: number;
  texture: { data: Uint8Array; height: number; width: number };
}

export const INF = 1e20;

// One dimension of the Felzenszwalb–Huttenlocher distance transform.
const edt1d = (
  f: Float64Array,
  n: number,
  d: Float64Array,
  v: Int32Array,
  z: Float64Array
): void => {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) {
      k++;
    }
    d[q] = (q - v[k]!) * (q - v[k]!) + f[v[k]!]!;
  }
};

// Squared distance to the nearest set cell, for every cell.
export const edt = (
  grid: Float64Array,
  width: number,
  height: number
): void => {
  const n = Math.max(width, height);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      f[y] = grid[y * width + x]!;
    }
    edt1d(f, height, d, v, z);
    for (let y = 0; y < height; y++) {
      grid[y * width + x] = d[y]!;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      f[x] = grid[y * width + x]!;
    }
    edt1d(f, width, d, v, z);
    for (let x = 0; x < width; x++) {
      grid[y * width + x] = Math.sqrt(d[x]!);
    }
  }
};

export const buildSdfFont = (
  characters: string,
  family = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  size = 40,
  radius = 8
): SdfFont => {
  const cell = Math.ceil(size * 1.4) + radius * 2;
  const columns = 16;
  const rows = Math.ceil(characters.length / columns);
  const width = columns * cell;
  const height = rows * cell;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.font = `600 ${size}px ${family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  const glyphs = new Map<string, Glyph>();
  [...characters].forEach((ch, i) => {
    const u = (i % columns) * cell;
    const v = Math.floor(i / columns) * cell;
    ctx.fillText(ch, u + radius, v + radius + size);
    glyphs.set(ch, { advance: ctx.measureText(ch).width, u, v });
  });
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const outside = new Float64Array(width * height);
  const inside = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const on = pixels[i * 4 + 3]! > 127;
    outside[i] = on ? 0 : INF;
    inside[i] = on ? INF : 0;
  }
  edt(outside, width, height);
  edt(inside, width, height);
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) {
    const signed = outside[i]! - inside[i]!;
    data[i] = Math.max(
      0,
      Math.min(255, Math.round(128 - (signed / radius) * 127))
    );
  }
  return { cell, glyphs, radius, size, texture: { data, height, width } };
};

// The width of a line of text at `px` pixels high.
export const measure = (
  font: SdfFont,
  text: string,
  px: number,
  tracking = 0
): number =>
  [...text].reduce(
    (w, ch) =>
      w +
      (font.glyphs.get(ch)?.advance ?? font.size * 0.5) * (px / font.size) +
      tracking,
    0
  ) - tracking;
