import { measureText } from './font';
import type { SlotSummary } from './save-slots';
import {
  FRAME_TILE_HEIGHT,
  drawWindowFrame,
  windowText,
  type WindowStyle
} from './window-frame';

// The title menu over the title screen once the boot sequence is over
// (docs/spec/title-menu.md): Resume, New Game and Load. The original
// has none, so this is the port's own, framed as the game's windows
// are (finding:ui-window-frame-tiles). A pure state machine over keys
// and clicks; main.ts carries out what it chooses.

export type TitleChoice =
  | { id: number; kind: 'load' }
  | { kind: 'new-game' }
  | { id: number; kind: 'resume' };

type MainItem = 'load' | 'new-game' | 'resume';

export type TitleMenu =
  | { items: MainItem[]; kind: 'main'; selected: number }
  // Asked before a new game when there is a save to resume.
  | { kind: 'confirm'; selected: number }
  | { kind: 'load'; selected: number; slots: SlotSummary[] }
  // A load that failed; any key or click goes back.
  | { kind: 'message'; lines: string[] };

export interface TitleSaves {
  // The autosave slot, or null.
  autosave: SlotSummary | null;
  // The named slots.
  slots: SlotSummary[];
}

// The most recent loadable save, autosave or named; an imported Archive,
// whose time was never recorded, counts as the oldest.
export const latestSave = (saves: TitleSaves): SlotSummary | null =>
  [...(saves.autosave ? [saves.autosave] : []), ...saves.slots]
    .filter(slot => slot.loadable)
    .reduce<SlotSummary | null>(
      (latest, slot) =>
        !latest || (slot.savedAt ?? -Infinity) > (latest.savedAt ?? -Infinity)
          ? slot
          : latest,
      null
    );

export const openTitleMenu = (saves: TitleSaves): TitleMenu => ({
  items: latestSave(saves)
    ? ['resume', 'new-game', 'load']
    : ['new-game', 'load'],
  kind: 'main',
  selected: 0
});

const MAIN_LABELS: Record<MainItem, string> = {
  load: 'Load',
  'new-game': 'New Game',
  resume: 'Resume'
};

export const CONFIRM_LINES = [
  'Start a new game? Your saves are',
  'kept, but the autosave will be',
  'written over when it next runs.'
];
const CONFIRM_ITEMS = ['Start a new game', 'Go back'];

export const LOAD_FAILED: Record<'other-version' | 'other', string[]> = {
  other: ['That save could not be loaded.'],
  'other-version': [
    'That save was made by another',
    'version of the game and cannot',
    'be loaded.'
  ]
};

// The Load list: the autosave first, then the named slots, newest first.
const loadList = (saves: TitleSaves): SlotSummary[] => [
  ...(saves.autosave ? [saves.autosave] : []),
  ...[...saves.slots].sort(
    (a, b) => (b.savedAt ?? -Infinity) - (a.savedAt ?? -Infinity)
  )
];

// The rows a menu offers, as lettered; the Load list ends with Back.
const rowCount = (menu: TitleMenu): number => {
  switch (menu.kind) {
    case 'main': {
      return menu.items.length;
    }
    case 'confirm': {
      return CONFIRM_ITEMS.length;
    }
    case 'load': {
      return menu.slots.length + 1;
    }
    case 'message': {
      return 0;
    }
  }
};

export type TitleStep = { choice?: TitleChoice; menu: TitleMenu };

// Choose the selected row.
const choose = (menu: TitleMenu, saves: TitleSaves): TitleStep => {
  switch (menu.kind) {
    case 'main': {
      const item = menu.items[menu.selected];
      if (item === 'resume') {
        const latest = latestSave(saves);
        return latest
          ? { choice: { id: latest.id, kind: 'resume' }, menu }
          : { menu };
      }
      if (item === 'new-game') {
        return latestSave(saves)
          ? { menu: { kind: 'confirm', selected: 1 } }
          : { choice: { kind: 'new-game' }, menu };
      }
      return { menu: { kind: 'load', selected: 0, slots: loadList(saves) } };
    }
    case 'confirm': {
      return menu.selected === 0
        ? { choice: { kind: 'new-game' }, menu }
        : { menu: openTitleMenu(saves) };
    }
    case 'load': {
      const slot = menu.slots[menu.selected];
      if (!slot) {
        return { menu: openTitleMenu(saves) };
      }
      return slot.loadable
        ? { choice: { id: slot.id, kind: 'load' }, menu }
        : { menu: { kind: 'message', lines: LOAD_FAILED['other-version'] } };
    }
    case 'message': {
      return { menu: openTitleMenu(saves) };
    }
  }
};

const select = (menu: TitleMenu, selected: number): TitleMenu =>
  menu.kind === 'message' ? menu : { ...menu, selected };

// A key: the arrows move, Enter or space chooses, Escape goes back.
export const pressTitleMenuKey = (
  menu: TitleMenu,
  key: string,
  saves: TitleSaves
): TitleStep => {
  if (menu.kind === 'message') {
    return { menu: openTitleMenu(saves) };
  }
  const rows = rowCount(menu);
  switch (key) {
    case 'ArrowUp': {
      return { menu: select(menu, (menu.selected + rows - 1) % rows) };
    }
    case 'ArrowDown': {
      return { menu: select(menu, (menu.selected + 1) % rows) };
    }
    case 'Enter':
    case ' ': {
      return choose(menu, saves);
    }
    case 'Escape': {
      return { menu: menu.kind === 'main' ? menu : openTitleMenu(saves) };
    }
    default: {
      return { menu };
    }
  }
};

export interface TitleMenuRow {
  // Lettered in grey: a save this build cannot load.
  dim: boolean;
  height: number;
  label: string;
  // Lettered at the right of the row: a save's in-game date.
  note: string | null;
  width: number;
  x: number;
  y: number;
}

export interface TitleMenuLayout {
  box: { height: number; width: number; x: number; y: number };
  // Lines lettered above the rows.
  lines: string[];
  rows: TitleMenuRow[];
}

// Where the menu sits: at the foot of the 320 by 200 screen, below the
// logo's lettering.
const INSET_X = 16;
const INSET_Y = 8;
const LINE_HEIGHT = 10;
const LINE_GAP = 6;
const ROW_HEIGHT = 12;
const MAIN_WIDTH = 112;
const WIDE_WIDTH = 224;
// The window's foot, above the screen's bottom edge.
const BOTTOM = 192;
// The Load list shows this many rows, scrolling to keep the selected
// one in view.
export const LOAD_ROWS = 6;

const fitRows = (
  labels: { dim?: boolean; label: string; note?: string | null }[],
  lines: string[],
  width: number,
  bottom: number
): TitleMenuLayout => {
  const x = (320 - width) / 2;
  // A gap parts the lines from the rows.
  const linesHeight =
    lines.length > 0 && labels.length > 0
      ? lines.length * LINE_HEIGHT + LINE_GAP
      : lines.length * LINE_HEIGHT;
  const height = INSET_Y * 2 + linesHeight + labels.length * ROW_HEIGHT;
  // The frame rounds the height up to whole tiles, so the top is found
  // from the rounded height.
  const top =
    bottom - Math.ceil(height / FRAME_TILE_HEIGHT) * FRAME_TILE_HEIGHT;
  const rowsTop = top + INSET_Y + linesHeight;
  return {
    box: { height, width, x, y: top },
    lines,
    rows: labels.map(({ dim = false, label, note = null }, i) => ({
      dim,
      height: ROW_HEIGHT,
      label,
      note,
      width: width - 2 * INSET_X,
      x: x + INSET_X,
      y: rowsTop + i * ROW_HEIGHT
    }))
  };
};

// The first Load row on show, given the selected one.
export const loadScroll = (selected: number, rows: number): number =>
  Math.max(0, Math.min(selected - LOAD_ROWS + 1, rows - LOAD_ROWS));

export const layoutTitleMenu = (menu: TitleMenu): TitleMenuLayout => {
  switch (menu.kind) {
    case 'main': {
      return fitRows(
        menu.items.map(item => ({ label: MAIN_LABELS[item] })),
        [],
        MAIN_WIDTH,
        BOTTOM
      );
    }
    case 'confirm': {
      return fitRows(
        CONFIRM_ITEMS.map(label => ({ label })),
        CONFIRM_LINES,
        WIDE_WIDTH,
        BOTTOM
      );
    }
    case 'load': {
      const all = [
        ...menu.slots.map(slot => ({
          dim: !slot.loadable,
          label: slot.name,
          note: slot.gameDate
        })),
        { label: 'Back' }
      ];
      const first = loadScroll(menu.selected, all.length);
      return fitRows(
        all.slice(first, first + LOAD_ROWS),
        menu.slots.length > 0 ? [] : ['There are no saves to load.'],
        WIDE_WIDTH,
        BOTTOM
      );
    }
    case 'message': {
      return fitRows([], menu.lines, WIDE_WIDTH, BOTTOM);
    }
  }
};

// The row index under a point, counting from the top of the whole list.
const rowAt = (
  menu: TitleMenu,
  point: { x: number; y: number }
): number | null => {
  const { rows } = layoutTitleMenu(menu);
  const i = rows.findIndex(
    row =>
      point.x >= row.x &&
      point.x < row.x + row.width &&
      point.y >= row.y &&
      point.y < row.y + row.height
  );
  if (i < 0) {
    return null;
  }
  return menu.kind === 'load'
    ? i + loadScroll(menu.selected, menu.slots.length + 1)
    : i;
};

// The pointer over a row selects it.
export const hoverTitleMenu = (
  menu: TitleMenu,
  point: { x: number; y: number }
): TitleMenu => {
  const row = rowAt(menu, point);
  return row === null ? menu : select(menu, row);
};

// A click chooses the row under it; a message goes at any click.
export const clickTitleMenu = (
  menu: TitleMenu,
  point: { x: number; y: number },
  saves: TitleSaves
): TitleStep => {
  if (menu.kind === 'message') {
    return { menu: openTitleMenu(saves) };
  }
  const row = rowAt(menu, point);
  return row === null ? { menu } : choose(select(menu, row), saves);
};

// The selected row on show, as an index into the layout's rows.
const selectedRow = (menu: TitleMenu): number | null => {
  switch (menu.kind) {
    case 'message': {
      return null;
    }
    case 'load': {
      return menu.selected - loadScroll(menu.selected, menu.slots.length + 1);
    }
    default: {
      return menu.selected;
    }
  }
};

// The menu's own colours on the parchment: the selected row, and a save
// this build cannot load.
export interface TitleMenuColours {
  dim: string;
  selected: string;
}

export const drawTitleMenu = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  colours: TitleMenuColours,
  menu: TitleMenu
): void => {
  const layout = layoutTitleMenu(menu);
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
  const selected = selectedRow(menu);
  layout.rows.forEach((row, i) => {
    const colour =
      i === selected
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
