// Over the Atlas map the screen is drawn at the window's resolution, and
// its windows and lettering are remastered to match the map: lettering
// set in a book face, frames inked as torn parchment
// (docs/spec/atlas-map.md). A context is marked remastered while it is;
// the drawing functions ask, so every window's layout stays the
// original's, measured in its pixel font.
import { BASE_URL } from './base-url';

interface Remastered {
  // Context units to one native pixel across: 2 on the hi-res Full Map
  // Level's buffer, whose pixels are half as wide.
  unitsAcross: number;
}

const remastered = new WeakMap<CanvasRenderingContext2D, Remastered>();

export const setRemastered = (
  ctx: CanvasRenderingContext2D,
  on: Remastered | null
): void => {
  if (on) {
    remastered.set(ctx, on);
  } else {
    remastered.delete(ctx);
  }
};

export const remasteredAs = (
  ctx: CanvasRenderingContext2D
): Remastered | undefined => remastered.get(ctx);

// EB Garamond, under the SIL Open Font License (fonts/EBGaramond-OFL.txt).
export const LETTERING_FAMILY = 'EB Garamond';

// Load the book face. Until it has loaded, or if it cannot, the browser
// letters in its own serif, so nothing waits on it.
export const loadLettering = async (): Promise<void> => {
  const face = new FontFace(
    LETTERING_FAMILY,
    `url(${BASE_URL}fonts/EBGaramond-Regular.woff2)`
  );
  document.fonts.add(face);
  try {
    await face.load();
  } catch {
    // The fallback serif stands in.
  }
};

// The Atlas map's ink nearest in hue to one of the original's palette
// colours, so remastered lettering sits with the map: near-black and
// greys in brown ink, blues slate, greens olive, reds brick, browns and
// yellows wood.
const INKS = {
  brick: '#a63c30',
  ink: '#3b2a1e',
  olive: '#4f5d2e',
  slate: '#4a6478',
  wood: '#7a4f2c'
} as const;

export const atlasInk = (colour: string): string => {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(colour);
  if (!match) {
    return colour;
  }
  const [r, g, b] = match.slice(1).map(hex => Number.parseInt(hex, 16) / 255);
  const max = Math.max(r!, g!, b!);
  const min = Math.min(r!, g!, b!);
  if (max - min < 0.15) {
    return INKS.ink;
  }
  if (max === b) {
    return INKS.slate;
  }
  if (max === g) {
    return INKS.olive;
  }
  // Red is the most: brick when it stands well clear of green.
  return g! < r! * 0.55 ? INKS.brick : INKS.wood;
};
