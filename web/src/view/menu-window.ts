import { measureText } from './font';
import type { SlotSummary } from './save-slots';
import {
  FRAME_TILE_HEIGHT,
  drawWindowFrame,
  windowText,
  type WindowStyle
} from './window-frame';

// The port's own menus, the title menu (docs/spec/title-menu.md) and
// the in-game menu (docs/spec/game-menu.md): a window of lines and rows
// to choose from, centred on the 320 by 200 screen over the scene
// dimmed behind it, and framed as the game's windows are
// (finding:ui-window-frame-tiles). Each menu describes what it shows as
// a MenuView; the layout, hit-testing and drawing here are shared.

export interface MenuRowSpec {
  // Lettered in grey: a save this build cannot load.
  dim?: boolean;
  label: string;
  // Lettered at the right of the row: a save's in-game date.
  note?: string | null;
}

export interface MenuView {
  // Lines lettered above the rows.
  lines: string[];
  rows: MenuRowSpec[];
  // The selected row, counted over all rows; null for none.
  selected: number | null;
  width: number;
}

export interface MenuRow {
  dim: boolean;
  height: number;
  label: string;
  note: string | null;
  width: number;
  x: number;
  y: number;
}

export interface MenuLayout {
  box: { height: number; width: number; x: number; y: number };
  // The first row on show, when a long list scrolls.
  first: number;
  lines: string[];
  // The rows on show.
  rows: MenuRow[];
}

export const NARROW_WIDTH = 112;
export const WIDE_WIDTH = 224;
const INSET_X = 16;
const INSET_Y = 8;
const LINE_HEIGHT = 10;
const LINE_GAP = 6;
const ROW_HEIGHT = 12;
const SCREEN = { height: 200, width: 320 };
// What is behind the menu is dimmed, so the window stands out.
export const MENU_DIM = 'rgba(0, 0, 0, 0.5)';
// A list shows this many rows, scrolling to keep the selected one in
// view.
export const LIST_ROWS = 6;

// The first row on show, given the selected one.
export const listScroll = (selected: number | null, rows: number): number =>
  Math.max(0, Math.min((selected ?? 0) - LIST_ROWS + 1, rows - LIST_ROWS));

export const layoutMenu = (view: MenuView): MenuLayout => {
  const first = listScroll(view.selected, view.rows.length);
  const shown = view.rows.slice(first, first + LIST_ROWS);
  const x = (SCREEN.width - view.width) / 2;
  // A gap parts the lines from the rows.
  const linesHeight =
    view.lines.length * LINE_HEIGHT +
    (view.lines.length > 0 && shown.length > 0 ? LINE_GAP : 0);
  const height = INSET_Y * 2 + linesHeight + shown.length * ROW_HEIGHT;
  // The frame rounds the height up to whole tiles, so the top is found
  // from the rounded height.
  const top = Math.floor(
    (SCREEN.height -
      Math.ceil(height / FRAME_TILE_HEIGHT) * FRAME_TILE_HEIGHT) /
      2
  );
  const rowsTop = top + INSET_Y + linesHeight;
  return {
    box: { height, width: view.width, x, y: top },
    first,
    lines: view.lines,
    rows: shown.map(({ dim = false, label, note = null }, i) => ({
      dim,
      height: ROW_HEIGHT,
      label,
      note,
      width: view.width - 2 * INSET_X,
      x: x + INSET_X,
      y: rowsTop + i * ROW_HEIGHT
    }))
  };
};

// The row under a point, counted over all rows, or null.
export const menuRowAt = (
  view: MenuView,
  point: { x: number; y: number }
): number | null => {
  const { first, rows } = layoutMenu(view);
  const i = rows.findIndex(
    row =>
      point.x >= row.x &&
      point.x < row.x + row.width &&
      point.y >= row.y &&
      point.y < row.y + row.height
  );
  return i < 0 ? null : first + i;
};

// The arrows move the selection over `rows`, wrapping; null for any
// other key.
export const moveSelection = (
  selected: number,
  rows: number,
  key: string
): number | null => {
  if (rows === 0) {
    return null;
  }
  if (key === 'ArrowUp') {
    return (selected + rows - 1) % rows;
  }
  if (key === 'ArrowDown') {
    return (selected + 1) % rows;
  }
  return null;
};

// A save as a list row: its name, its in-game date, grey when this
// build cannot load it.
export const slotRow = (slot: SlotSummary): MenuRowSpec => ({
  dim: !slot.loadable,
  label: slot.name,
  note: slot.gameDate
});

// The label of a game started from a Shuffled Setup
// (docs/spec/shuffled-setup.md); a Classic Setup has none.
export const setupLabel = (seed: number): string => `Shuffled Setup ${seed}`;

// The line over a Load list naming the selected save's Setup, shown
// only when some save listed has a Shuffled Setup, so the window keeps
// its height as the selection moves.
export const loadListLines = (
  slots: readonly SlotSummary[],
  selected: number
): string[] => {
  if (slots.length === 0) {
    return ['There are no saves to load.'];
  }
  if (!slots.some(slot => slot.setupSeed !== null)) {
    return [];
  }
  const seed = slots[selected]?.setupSeed ?? null;
  return [seed === null ? '' : setupLabel(seed)];
};

// Saves newest first; an imported Archive, never timed, last.
export const newestFirst = (slots: readonly SlotSummary[]): SlotSummary[] =>
  [...slots].sort(
    (a, b) => (b.savedAt ?? -Infinity) - (a.savedAt ?? -Infinity)
  );

// The menus' own colours on the parchment: the selected row, and a save
// this build cannot load.
export interface MenuColours {
  dim: string;
  selected: string;
}

export const drawMenu = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  colours: MenuColours,
  view: MenuView
): void => {
  const layout = layoutMenu(view);
  ctx.fillStyle = MENU_DIM;
  ctx.fillRect(0, 0, SCREEN.width, SCREEN.height);
  const box = drawWindowFrame(ctx, style, layout.box);
  layout.lines.forEach((line, i) => {
    windowText(
      ctx,
      style,
      line,
      box.x + INSET_X,
      box.y + INSET_Y + i * LINE_HEIGHT
    );
  });
  layout.rows.forEach((row, i) => {
    const colour =
      layout.first + i === view.selected
        ? colours.selected
        : row.dim
          ? colours.dim
          : style.colours.text;
    windowText(ctx, style, row.label, row.x, row.y + 1, colour);
    if (row.note) {
      // Set against the row's right end.
      const width = measureText(style.font.metrics, row.note);
      windowText(
        ctx,
        style,
        row.note,
        row.x + row.width - width,
        row.y + 1,
        colour
      );
    }
  });
};
