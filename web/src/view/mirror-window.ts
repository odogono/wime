import { MIRROR_HEADING, type MirrorListing } from '../sim/index';
import { drawWindowFrame, type WindowStyle } from './window-frame';

// The Galadriel's Mirror window (docs/spec/full-map.md), drawn into the
// Full Map Level's 640 by 200 hi-res buffer. The original puts the
// Good column at x 10, followers 6 pixels further right, and the Evil
// column at x 412, with 9 pixels a row
// (finding:ui-galadriels-mirror-lists-forces-on-the-move). It is
// framed as every window is, its tiles at hi-res pixel size
// (finding:ui-window-box-geometry); the lettering is provisional until
// the original font is identified.

export interface MirrorWindow {
  height: number;
  listing: MirrorListing;
  width: number;
  x: number;
  y: number;
}

const ROW_HEIGHT = 9;
const PADDING = 8;
const GOOD_X = 10;
const FOLLOWER_INDENT = 6;
const EVIL_X = 412;
// The 8px monospace lettering is widened to about 8 hi-res pixels a
// character, the width of an Amiga hi-res font.
const TEXT_STRETCH = 1.6;

// The original opens the box at (10, 5), 272 wide and 24 deep plus 9 a
// row (code+0x07e08). On the Full Map Level a box's x and width are
// doubled, and x 20 is moved onto 16 (finding:ui-window-box-geometry).
export const layoutMirrorWindow = (listing: MirrorListing): MirrorWindow => {
  const rows = Math.max(1, listing.good.length, listing.evil.length);
  return {
    height: 24 + rows * ROW_HEIGHT,
    listing,
    width: 544,
    x: 16,
    y: 5
  };
};

export const drawHiresText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number
): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(TEXT_STRETCH, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
};

export const drawMirrorWindow = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  window: MirrorWindow
): void => {
  drawWindowFrame(ctx, style, window);
  ctx.fillStyle = style.colours.red;
  drawHiresText(ctx, MIRROR_HEADING, window.x + GOOD_X, window.y + PADDING);
  ctx.fillStyle = style.colours.text;
  const top = window.y + PADDING + ROW_HEIGHT;
  window.listing.good.forEach((row, i) => {
    drawHiresText(
      ctx,
      row.text,
      window.x + GOOD_X + (row.follower ? FOLLOWER_INDENT : 0),
      top + i * ROW_HEIGHT
    );
  });
  window.listing.evil.forEach((name, i) => {
    drawHiresText(ctx, name, window.x + EVIL_X, top + i * ROW_HEIGHT);
  });
};
