import {
  NARROW_WIDTH,
  WIDE_WIDTH,
  drawMenu,
  layoutMenu,
  menuRowAt,
  moveSelection,
  newestFirst,
  slotRow,
  type MenuColours,
  type MenuLayout,
  type MenuView
} from './menu-window';
import type { SlotSummary } from './save-slots';
import type { WindowStyle } from './window-frame';

// The title menu over the title screen once the boot sequence is over
// (docs/spec/title-menu.md): Resume, New Game, Demo and Load. The original
// has none, so this is the port's own, framed as the game's windows
// are (menu-window.ts). A pure state machine over keys and clicks;
// main.ts carries out what it chooses.

export type TitleChoice =
  | { id: number; kind: 'load' }
  | { kind: 'demo' }
  | { kind: 'new-game' }
  | { id: number; kind: 'resume' };

type MainItem = 'demo' | 'load' | 'new-game' | 'resume';

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
    ? ['resume', 'new-game', 'demo', 'load']
    : ['new-game', 'demo', 'load'],
  kind: 'main',
  selected: 0
});

const MAIN_LABELS: Record<MainItem, string> = {
  demo: 'Demo',
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
export const loadList = (saves: TitleSaves): SlotSummary[] => [
  ...(saves.autosave ? [saves.autosave] : []),
  ...newestFirst(saves.slots)
];

export type TitleStep = { choice?: TitleChoice; menu: TitleMenu };

// What a menu shows.
export const titleMenuView = (menu: TitleMenu): MenuView => {
  switch (menu.kind) {
    case 'main': {
      return {
        lines: [],
        rows: menu.items.map(item => ({ label: MAIN_LABELS[item] })),
        selected: menu.selected,
        width: NARROW_WIDTH
      };
    }
    case 'confirm': {
      return {
        lines: CONFIRM_LINES,
        rows: CONFIRM_ITEMS.map(label => ({ label })),
        selected: menu.selected,
        width: WIDE_WIDTH
      };
    }
    case 'load': {
      return {
        lines: menu.slots.length > 0 ? [] : ['There are no saves to load.'],
        rows: [...menu.slots.map(slotRow), { label: 'Back' }],
        selected: menu.selected,
        width: WIDE_WIDTH
      };
    }
    case 'message': {
      return { lines: menu.lines, rows: [], selected: null, width: WIDE_WIDTH };
    }
  }
};

export const layoutTitleMenu = (menu: TitleMenu): MenuLayout =>
  layoutMenu(titleMenuView(menu));

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
      if (item === 'demo') {
        return { choice: { kind: 'demo' }, menu };
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
  const moved = moveSelection(
    menu.selected,
    titleMenuView(menu).rows.length,
    key
  );
  if (moved !== null) {
    return { menu: select(menu, moved) };
  }
  switch (key) {
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

// The pointer over a row selects it.
export const hoverTitleMenu = (
  menu: TitleMenu,
  point: { x: number; y: number }
): TitleMenu => {
  const row = menuRowAt(titleMenuView(menu), point);
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
  const row = menuRowAt(titleMenuView(menu), point);
  return row === null ? { menu } : choose(select(menu, row), saves);
};

export const drawTitleMenu = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  colours: MenuColours,
  menu: TitleMenu
): void => {
  drawMenu(ctx, style, colours, titleMenuView(menu));
};

// After this long with no input at the main title menu an idle Demo
// starts (docs/spec/demo-mode.md). The Load list, the new-game
// confirmation and a message pause the wait; any input starts it again.
export const IDLE_DEMO_MS = 60_000;

// The time idled at the title menu, after `elapsedMs` more of it on `menu`.
export const stepTitleIdle = (
  idleMs: number,
  menu: TitleMenu,
  elapsedMs: number
): number => (menu.kind === 'main' ? idleMs + elapsedMs : idleMs);

export const idleDemoDue = (idleMs: number): boolean => idleMs >= IDLE_DEMO_MS;
