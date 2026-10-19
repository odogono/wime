import { MIRROR_HEADING, type MirrorListing } from '../sim/index';

// The Galadriel's Mirror window (docs/spec/full-map.md), drawn into the
// Full Map Level's 640 by 200 hi-res buffer. The original puts the
// Good column at x 10, followers 6 pixels further right, and the Evil
// column at x 412, with 9 pixels a row
// (finding:ui-galadriels-mirror-lists-forces-on-the-move). The frame
// and lettering follow the other windows' provisional style until the
// original window graphics and font are identified.

export interface MirrorWindow {
  height: number;
  listing: MirrorListing;
  width: number;
  x: number;
  y: number;
}

const ROW_HEIGHT = 9;
const HEADING_HEIGHT = 14;
const PADDING = 4;
const GOOD_X = 10;
const FOLLOWER_INDENT = 6;
const EVIL_X = 412;
// The 8px monospace lettering is widened to about 8 hi-res pixels a
// character, the width of an Amiga hi-res font.
const TEXT_STRETCH = 1.6;

export const layoutMirrorWindow = (listing: MirrorListing): MirrorWindow => {
  const rows = Math.max(1, listing.good.length, listing.evil.length);
  return {
    height: PADDING * 2 + HEADING_HEIGHT + rows * ROW_HEIGHT,
    listing,
    width: 588,
    x: 4,
    y: 4
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
  window: MirrorWindow
): void => {
  ctx.fillStyle = '#000';
  ctx.fillRect(window.x, window.y, window.width, window.height);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    window.x + 0.5,
    window.y + 0.5,
    window.width - 1,
    window.height - 1
  );
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ff0';
  drawHiresText(ctx, MIRROR_HEADING, window.x + GOOD_X, window.y + PADDING);
  ctx.fillStyle = '#fff';
  const top = window.y + PADDING + HEADING_HEIGHT;
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
