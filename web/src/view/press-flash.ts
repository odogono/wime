import { FRAME_MS } from './tick-driver';
import type { Box } from './window-frame';

// A pressed icon or button flashes before the press acts
// (finding:ui-press-flash): its area is toggled 6 times, 4 frames apart,
// each toggle swapping every pixel's colour c for c XOR 8, so it shows
// swapped, plain, swapped, plain, swapped and plain again. The magnifying
// glass toggles the found Force's icon 4 times. The game stands still
// meanwhile, and the press acts once the flash is over.

export const FLASH_STEP_MS = 4 * FRAME_MS;
export const PRESS_TOGGLES = 6;
export const GLASS_TOGGLES = 4;

export interface PressFlash {
  area: Box;
  start: number;
  toggles: number;
}

const flashOver = (flash: PressFlash, now: number): boolean =>
  now >= flash.start + flash.toggles * FLASH_STEP_MS;

// Whether the area shows swapped at `now`: after the first toggle, the
// third and the fifth.
const flashSwapped = (flash: PressFlash, now: number): boolean => {
  const step = Math.floor((now - flash.start) / FLASH_STEP_MS);
  return step >= 0 && step < flash.toggles && step % 2 === 0;
};

// What a flashing area shows on a frame; 'over' once, as it ends.
export type FlashShows = 'swapped' | 'plain' | 'over';

export interface Presses {
  // Show the flash at `now`, and act once it is over. True while the
  // flash holds the game, when the frame goes no further.
  frame(now: number): boolean;
  // Whether a flash holds the game: other presses and keys do nothing.
  readonly holding: boolean;
  // Ring the bell and flash `area`; `act` runs once the flash is over.
  // Ignored while another flash holds the game.
  press(area: Box, act: () => void, toggles?: number): void;
}

export const createPresses = ({
  now,
  ring,
  show
}: {
  now: () => number;
  ring: () => void;
  show: (area: Box, shows: FlashShows) => void;
}): Presses => {
  let flash: (PressFlash & { act: () => void }) | null = null;
  return {
    frame(at) {
      if (!flash) {
        return false;
      }
      if (!flashOver(flash, at)) {
        show(flash.area, flashSwapped(flash, at) ? 'swapped' : 'plain');
        return true;
      }
      const { act, area } = flash;
      show(area, 'over');
      flash = null;
      act();
      return false;
    },
    get holding() {
      return flash !== null;
    },
    press(area, act, toggles = PRESS_TOGGLES) {
      if (flash) {
        return;
      }
      ring();
      flash = { act, area, start: now(), toggles };
    }
  };
};

const rgb = (hex: string): number => Number.parseInt(hex.replace('#', ''), 16);

// Swap each pixel's colour c for c XOR 8 within `palette`, in place.
// Pixels of other colours are left as they are.
export const swapColours = (
  data: Uint8ClampedArray,
  palette: readonly string[]
): void => {
  const index = new Map<number, number>();
  palette.forEach((hex, i) => {
    if (!index.has(rgb(hex))) {
      index.set(rgb(hex), i);
    }
  });
  for (let p = 0; p < data.length; p += 4) {
    const i = index.get((data[p]! << 16) | (data[p + 1]! << 8) | data[p + 2]!);
    const swapped = i === undefined ? undefined : palette[i ^ 8];
    if (swapped !== undefined) {
      const value = rgb(swapped);
      data[p] = value >> 16;
      data[p + 1] = (value >> 8) & 0xff;
      data[p + 2] = value & 0xff;
    }
  }
};
