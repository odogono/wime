import {
  FULL_MAP_DOT_HEIGHT,
  FULL_MAP_DOT_WIDTH,
  type FullMapDot
} from '../sim/index';
import type { FULL_MAP_ICON_NAMES, FullMapPalette } from './assets';

export type FullMapIconName = (typeof FULL_MAP_ICON_NAMES)[number];

export interface FullMapIcon {
  image: CanvasImageSource & { height: number; width: number };
  name: FullMapIconName;
}

export interface FullMapLevel {
  icons: FullMapIcon[];
  map: CanvasImageSource;
  palette: FullMapPalette;
}

export interface FullMapIconPlacement {
  icon: FullMapIcon;
  x: number;
  y: number;
}

// Where the original centres each icon, in hi-res pixels
// (finding:graphics-full-map-icon-imag-ids).
export const FULL_MAP_ICON_CENTRES: Record<
  FullMapIconName,
  { x: number; y: number }
> = {
  eye: { x: 600, y: 10 },
  hourglass: { x: 600, y: 61 },
  'magnifying-glass': { x: 600, y: 42 },
  scroll: { x: 600, y: 24 }
};

// The palette colours the dots are drawn in
// (finding:ui-full-map-dot-colours): red for Evil, green for the rest,
// and cyan or cream for the two phases of a blinking dot.
export const DOT_COLOUR_INDEX = {
  blinkOff: 15,
  blinkOn: 12,
  green: 14,
  red: 10
} as const;

// Each phase of the blink waits 30 ticks, probably PAL frames
// (finding:ui-full-map-dots-blink-every-30-ticks); provisional.
export const BLINK_PHASE_MS = 600;

export const fullMapIconPlacements = (
  icons: FullMapIcon[]
): FullMapIconPlacement[] =>
  icons.map(icon => {
    const centre = FULL_MAP_ICON_CENTRES[icon.name];
    return {
      icon,
      x: centre.x - Math.floor(icon.image.width / 2),
      y: centre.y - Math.floor(icon.image.height / 2)
    };
  });

// The colour each dot is filled with, in drawing order: every dot in
// its base colour first, then the blinking ones over them in the
// current phase, as the original's two passes do.
export const dotFills = (
  dots: FullMapDot[],
  blinkOn: boolean
): { colourIndex: number; dot: FullMapDot }[] => [
  ...dots.map(dot => ({
    colourIndex:
      dot.colour === 'red' ? DOT_COLOUR_INDEX.red : DOT_COLOUR_INDEX.green,
    dot
  })),
  ...dots
    .filter(dot => dot.blinks)
    .map(dot => ({
      colourIndex: blinkOn
        ? DOT_COLOUR_INDEX.blinkOn
        : DOT_COLOUR_INDEX.blinkOff,
      dot
    }))
];

// Draw the Full Map Level into the 640 by 200 hi-res buffer.
export const drawFullMapLevel = (
  ctx: CanvasRenderingContext2D,
  level: FullMapLevel,
  dots: FullMapDot[],
  blinkOn: boolean
): void => {
  ctx.drawImage(level.map, 0, 0);
  for (const { colourIndex, dot } of dotFills(dots, blinkOn)) {
    ctx.fillStyle = level.palette.hex[colourIndex] ?? '#fff';
    ctx.fillRect(dot.x, dot.y, FULL_MAP_DOT_WIDTH, FULL_MAP_DOT_HEIGHT);
  }
  for (const { icon, x, y } of fullMapIconPlacements(level.icons)) {
    ctx.drawImage(icon.image, x, y);
  }
};
