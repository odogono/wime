import {
  NARROW_WIDTH,
  WIDE_WIDTH,
  drawMenu,
  menuRowAt,
  moveSelection,
  newestFirst,
  slotRow,
  type MenuColours,
  type MenuView
} from './menu-window';
import type { SlotFailure, SlotSummary } from './save-slots';
import { LOAD_FAILED, loadList, type TitleSaves } from './title-menu';
import type { WindowStyle } from './window-frame';

// The in-game menu (docs/spec/game-menu.md): Save, Load, Return to
// title and Close, opened during play on every Level. The original has
// none; its Archive window keeps its own single slot
// (finding:ui-archive-window). A pure state machine over keys and
// clicks, as the title menu is; main.ts carries out what it chooses.
// After the ending's last page a shorter menu, Return to title and Load,
// is the way out (docs/spec/winning-and-losing.md). Each step takes the
// menu that Back and Escape return to, the in-game menu by default.

export type GameMenuChoice =
  | { id: number; kind: 'load' }
  | { id: number; kind: 'save-over' }
  | { kind: 'close' }
  | { kind: 'save-new'; name: string }
  | { kind: 'title' };

type MainItem = 'close' | 'load' | 'save' | 'title';
const MAIN_ITEMS: MainItem[] = ['save', 'load', 'title', 'close'];
const ENDED_ITEMS: MainItem[] = ['title', 'load'];
const MAIN_LABELS: Record<MainItem, string> = {
  close: 'Close',
  load: 'Load',
  save: 'Save',
  title: 'Return to title'
};

export type GameMenu =
  | { ended?: true; kind: 'main'; selected: number }
  // The named slots to save into; the autosave is not offered.
  | { kind: 'save'; selected: number; slots: SlotSummary[] }
  // Naming a new save, typed in.
  | { kind: 'name'; selected: number; text: string }
  // Asked before saving over a slot, or loading over the game in play.
  | {
      action: 'load' | 'save-over';
      kind: 'confirm';
      selected: number;
      slot: SlotSummary;
    }
  | { kind: 'load'; selected: number; slots: SlotSummary[] }
  // What a save or load came to; any key or click goes back.
  | { kind: 'message'; lines: string[] };

export const openGameMenu = (): GameMenu => ({ kind: 'main', selected: 0 });

export const openEndedMenu = (): GameMenu => ({
  ended: true,
  kind: 'main',
  selected: 0
});

const mainItems = (menu: { ended?: true }): MainItem[] =>
  menu.ended ? ENDED_ITEMS : MAIN_ITEMS;

export const NAME_LIMIT = 24;
const NAME_ITEMS = ['Save', 'Back'];

export const gameMenuMessage = (lines: string[]): GameMenu => ({
  kind: 'message',
  lines
});

export const SAVED = (name: string): string[] => [
  `The game was saved as ${name}.`
];
export const SAVE_FAILED: Record<'full' | 'other', string[]> = {
  full: ['There is no room left to save', 'the game; it was not saved.'],
  other: ['The game could not be saved.']
};
export const saveFailed = (reason: SlotFailure): string[] =>
  SAVE_FAILED[reason === 'full' ? 'full' : 'other'];
export const AUTOSAVE_FAILED = [
  'The game could not be autosaved,',
  'so it stays in play. Save it to',
  'a slot before leaving.'
];
export const loadFailed = (reason: SlotFailure): string[] =>
  LOAD_FAILED[reason === 'other-version' ? 'other-version' : 'other'];

export const gameMenuView = (menu: GameMenu): MenuView => {
  switch (menu.kind) {
    case 'main': {
      return {
        lines: [],
        rows: mainItems(menu).map(item => ({ label: MAIN_LABELS[item] })),
        selected: menu.selected,
        width: NARROW_WIDTH
      };
    }
    case 'save': {
      return {
        lines: [],
        rows: [
          { label: 'New save' },
          ...menu.slots.map(slotRow),
          { label: 'Back' }
        ],
        selected: menu.selected,
        width: WIDE_WIDTH
      };
    }
    case 'name': {
      // A bar marks where the next letter goes; lord/10's underscore is
      // blank.
      return {
        lines: ['Name the save:', `${menu.text}|`],
        rows: NAME_ITEMS.map(label => ({ label })),
        selected: menu.selected,
        width: WIDE_WIDTH
      };
    }
    case 'confirm': {
      const name = menu.slot.name;
      return menu.action === 'save-over'
        ? {
            lines: [`Save over ${name}?`],
            rows: [{ label: 'Save over it' }, { label: 'Go back' }],
            selected: menu.selected,
            width: WIDE_WIDTH
          }
        : {
            lines: [`Load ${name}? The game in`, 'play is lost if not saved.'],
            rows: [{ label: 'Load it' }, { label: 'Go back' }],
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

export type GameMenuStep = { choice?: GameMenuChoice; menu: GameMenu };

const choose = (
  menu: GameMenu,
  saves: TitleSaves,
  home: GameMenu
): GameMenuStep => {
  switch (menu.kind) {
    case 'main': {
      switch (mainItems(menu)[menu.selected]) {
        case 'save': {
          return {
            menu: {
              kind: 'save',
              selected: 0,
              slots: newestFirst(saves.slots)
            }
          };
        }
        case 'load': {
          return {
            menu: { kind: 'load', selected: 0, slots: loadList(saves) }
          };
        }
        case 'title': {
          return { choice: { kind: 'title' }, menu };
        }
        default: {
          return { choice: { kind: 'close' }, menu };
        }
      }
    }
    case 'save': {
      if (menu.selected === 0) {
        return { menu: { kind: 'name', selected: 0, text: '' } };
      }
      const slot = menu.slots[menu.selected - 1];
      return slot
        ? {
            menu: { action: 'save-over', kind: 'confirm', selected: 1, slot }
          }
        : { menu: home };
    }
    case 'name': {
      return menu.selected === 0
        ? { choice: { kind: 'save-new', name: menu.text }, menu }
        : { menu: home };
    }
    case 'confirm': {
      if (menu.selected !== 0) {
        return { menu: home };
      }
      return {
        choice: {
          id: menu.slot.id,
          kind: menu.action === 'load' ? 'load' : 'save-over'
        },
        menu
      };
    }
    case 'load': {
      const slot = menu.slots[menu.selected];
      if (!slot) {
        return { menu: home };
      }
      return slot.loadable
        ? { menu: { action: 'load', kind: 'confirm', selected: 1, slot } }
        : { menu: gameMenuMessage(LOAD_FAILED['other-version']) };
    }
    case 'message': {
      return { menu: home };
    }
  }
};

const select = (menu: GameMenu, selected: number): GameMenu =>
  menu.kind === 'message' ? menu : { ...menu, selected };

// Typing a name: printable keys add to it, Backspace takes from it.
const typeName = (
  menu: Extract<GameMenu, { kind: 'name' }>,
  key: string
): GameMenu | null => {
  if (key === 'Backspace') {
    return { ...menu, text: menu.text.slice(0, -1) };
  }
  if (key.length === 1 && key >= ' ' && menu.text.length < NAME_LIMIT) {
    return { ...menu, text: menu.text + key };
  }
  return null;
};

// A key: the arrows move, Enter or space chooses, Escape goes back and,
// on the first menu, closes it. While a name is typed, space is a
// letter.
export const pressGameMenuKey = (
  menu: GameMenu,
  key: string,
  saves: TitleSaves,
  home: GameMenu = openGameMenu()
): GameMenuStep => {
  if (menu.kind === 'message') {
    return { menu: home };
  }
  const moved = moveSelection(
    menu.selected,
    gameMenuView(menu).rows.length,
    key
  );
  if (moved !== null) {
    return { menu: select(menu, moved) };
  }
  if (key === 'Enter') {
    return choose(menu, saves, home);
  }
  if (key === 'Escape') {
    if (menu.kind !== 'main') {
      return { menu: home };
    }
    return menu.ended ? { menu } : { choice: { kind: 'close' }, menu };
  }
  if (menu.kind === 'name') {
    return { menu: typeName(menu, key) ?? menu };
  }
  return key === ' ' ? choose(menu, saves, home) : { menu };
};

export const hoverGameMenu = (
  menu: GameMenu,
  point: { x: number; y: number }
): GameMenu => {
  const row = menuRowAt(gameMenuView(menu), point);
  return row === null ? menu : select(menu, row);
};

// A click chooses the row under it; a message goes at any click.
export const clickGameMenu = (
  menu: GameMenu,
  point: { x: number; y: number },
  saves: TitleSaves,
  home: GameMenu = openGameMenu()
): GameMenuStep => {
  if (menu.kind === 'message') {
    return { menu: home };
  }
  const row = menuRowAt(gameMenuView(menu), point);
  return row === null ? { menu } : choose(select(menu, row), saves, home);
};

export const drawGameMenu = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  colours: MenuColours,
  menu: GameMenu
): void => {
  drawMenu(ctx, style, colours, gameMenuView(menu));
};
