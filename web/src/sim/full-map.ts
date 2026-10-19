import type { RosterEntry } from './starting-state';

// The Full Map Level's dots (finding:ui-full-map-dots-for-awake-leaders,
// finding:ui-full-map-dot-colours). The rules are the original's; only
// the drawing is the view's.

// Entries after this are Encounter figures, which never get a dot.
const LAST_DOT_ENTRY = 151;

// Each dot is 3 by 2 hi-res pixels.
export const FULL_MAP_DOT_WIDTH = 3;
export const FULL_MAP_DOT_HEIGHT = 2;

export interface FullMapDot {
  // Allegiance above 2 is redrawn blinking over its green
  // (finding:mobilisation-allegiance-byte).
  blinks: boolean;
  // Allegiance 0 is drawn red, any other green.
  colour: 'green' | 'red';
  index: number;
  // Top left, in the Full Map's 640 by 200 hi-res pixels.
  x: number;
  y: number;
}

// Every dot in the original's drawing order, entry 151 down to 1.
// A dot is drawn for an awake entry that leads its own Force, except
// a Good entry not yet mobilised (allegiance 1) with no trigger.
export const fullMapDots = (roster: RosterEntry[]): FullMapDot[] => {
  const dots: FullMapDot[] = [];
  for (let index = LAST_DOT_ENTRY; index >= 1; index--) {
    const entry = roster[index];
    if (
      !entry?.position ||
      entry.state === 0 ||
      entry.leader !== null ||
      (entry.triggerByte === 0 && entry.allegiance === 1)
    ) {
      continue;
    }
    dots.push({
      blinks: entry.allegiance > 2,
      colour: entry.allegiance === 0 ? 'red' : 'green',
      index,
      // The map is a quarter of the Campaign Level's width and an
      // eighth of its height (finding:map-positions-are-campaign-pixels).
      x: entry.position.x >> 2,
      y: entry.position.y >> 3
    });
  }
  return dots;
};
