// Glyph masks for the labels drawn on contact and tile sheets.
//
// The Python tools drew these labels with Pillow's default font. The masks
// below were rasterized from that font (Pillow 13, size 10) for the only
// characters the labels use - digits and the minus sign of negative resource
// ids - so the sheets stay pixel-identical to the Python output. Each glyph
// is an alpha mask with its offset from the text origin and its advance.

export type SheetGlyph = {
  advance: number;
  offsetX: number;
  offsetY: number;
  rows: number[][];
};

export const SHEET_GLYPHS: Record<string, SheetGlyph> = {
  '0': {
    advance: 6,
    offsetX: 0,
    offsetY: 2,
    rows: [
      [15, 176, 196, 176, 15],
      [138, 114, 0, 115, 136],
      [212, 26, 0, 27, 211],
      [235, 2, 0, 2, 234],
      [235, 2, 0, 2, 234],
      [212, 26, 0, 27, 211],
      [138, 114, 0, 115, 137],
      [15, 176, 196, 176, 15]
    ]
  },
  '1': {
    advance: 6,
    offsetX: 1,
    offsetY: 2,
    rows: [
      [16, 160, 241],
      [195, 109, 240],
      [24, 0, 240],
      [0, 0, 240],
      [0, 0, 240],
      [0, 0, 240],
      [0, 0, 240],
      [0, 0, 240]
    ]
  },
  '2': {
    advance: 6,
    offsetX: 0,
    offsetY: 2,
    rows: [
      [0, 98, 195, 208, 70],
      [21, 193, 2, 40, 215],
      [40, 85, 0, 11, 234],
      [0, 0, 0, 95, 157],
      [0, 0, 35, 212, 21],
      [0, 12, 204, 55, 0],
      [1, 173, 89, 0, 0],
      [97, 244, 192, 192, 180]
    ]
  },
  '3': {
    advance: 6,
    offsetX: 0,
    offsetY: 2,
    rows: [
      [10, 169, 192, 205, 75],
      [118, 116, 0, 25, 224],
      [17, 6, 0, 68, 219],
      [0, 0, 163, 245, 67],
      [0, 0, 0, 79, 162],
      [147, 4, 0, 3, 237],
      [162, 84, 0, 61, 198],
      [30, 191, 193, 187, 40]
    ]
  },
  '4': {
    advance: 6,
    offsetX: 0,
    offsetY: 2,
    rows: [
      [0, 0, 0, 74, 247, 0],
      [0, 0, 13, 198, 242, 0],
      [0, 0, 149, 86, 240, 0],
      [0, 60, 175, 0, 240, 0],
      [7, 200, 26, 0, 240, 0],
      [90, 213, 192, 192, 252, 162],
      [0, 0, 0, 0, 240, 0],
      [0, 0, 0, 0, 240, 0]
    ]
  },
  '5': {
    advance: 6,
    offsetX: 0,
    offsetY: 2,
    rows: [
      [69, 222, 192, 192, 132],
      [93, 104, 0, 0, 0],
      [118, 79, 0, 0, 0],
      [143, 154, 196, 178, 35],
      [142, 107, 0, 82, 190],
      [32, 3, 0, 3, 235],
      [168, 79, 0, 58, 190],
      [37, 196, 192, 184, 35]
    ]
  },
  '6': {
    advance: 6,
    offsetX: 0,
    offsetY: 2,
    rows: [
      [2, 146, 199, 194, 34],
      [106, 133, 0, 81, 174],
      [197, 36, 0, 6, 118],
      [235, 114, 192, 175, 32],
      [241, 83, 0, 83, 189],
      [218, 3, 0, 3, 235],
      [152, 65, 0, 65, 188],
      [22, 179, 191, 187, 35]
    ]
  },
  '7': {
    advance: 6,
    offsetX: 0,
    offsetY: 2,
    rows: [
      [168, 192, 192, 198, 236],
      [0, 0, 0, 100, 130],
      [0, 0, 1, 207, 22],
      [0, 0, 78, 154, 0],
      [0, 0, 193, 39, 0],
      [0, 55, 177, 0, 0],
      [0, 173, 62, 0, 0],
      [36, 199, 0, 0, 0]
    ]
  },
  '8': {
    advance: 6,
    offsetX: 0,
    offsetY: 2,
    rows: [
      [67, 198, 191, 195, 57],
      [224, 33, 0, 35, 214],
      [205, 52, 0, 54, 225],
      [53, 248, 211, 248, 76],
      [193, 83, 0, 85, 158],
      [238, 2, 0, 3, 236],
      [199, 61, 0, 60, 204],
      [47, 193, 193, 192, 48]
    ]
  },
  '9': {
    advance: 6,
    offsetX: 0,
    offsetY: 2,
    rows: [
      [33, 185, 192, 180, 23],
      [187, 67, 0, 67, 151],
      [235, 3, 0, 3, 217],
      [189, 81, 0, 84, 240],
      [33, 175, 191, 115, 234],
      [122, 6, 0, 37, 196],
      [174, 80, 0, 133, 107],
      [36, 196, 199, 147, 2]
    ]
  },
  '-': {
    advance: 3,
    offsetX: 0,
    offsetY: 6,
    rows: [
      [132, 192, 81]
    ]
  },
};

// An RGBA pixel buffer, row-major, four bytes per pixel.
export type RgbaImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

// Draws a sheet label the way Pillow's ImageDraw.text did: each glyph mask
// blends the fill colour over what is already there. Characters without a
// glyph are skipped without advancing, which cannot happen for the numeric
// labels the sheets use.
export const drawSheetLabel = (
  image: RgbaImage,
  x: number,
  y: number,
  text: string,
  fill: [number, number, number]
): void => {
  let cursorX = x;
  for (const char of text) {
    const glyph = SHEET_GLYPHS[char];
    if (glyph === undefined) {
      continue;
    }
    for (let row = 0; row < glyph.rows.length; row++) {
      const targetY = y + glyph.offsetY + row;
      if (targetY < 0 || targetY >= image.height) {
        continue;
      }
      const maskRow = glyph.rows[row]!;
      for (let column = 0; column < maskRow.length; column++) {
        const alpha = maskRow[column]!;
        if (alpha === 0) {
          continue;
        }
        const targetX = cursorX + glyph.offsetX + column;
        if (targetX < 0 || targetX >= image.width) {
          continue;
        }
        const index = (targetY * image.width + targetX) * 4;
        for (let channel = 0; channel < 3; channel++) {
          const background = image.data[index + channel]!;
          image.data[index + channel] = Math.round(
            (fill[channel]! * alpha + background * (255 - alpha)) / 255
          );
        }
      }
    }
    cursorX += glyph.advance;
  }
};
