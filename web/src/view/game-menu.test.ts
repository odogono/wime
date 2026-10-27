import { describe, expect, test } from 'bun:test';

import {
  NAME_LIMIT,
  clickGameMenu,
  gameMenuView,
  hoverGameMenu,
  openGameMenu,
  pressGameMenuKey,
  type GameMenu,
  type GameMenuStep
} from './game-menu';
import { layoutMenu } from './menu-window';
import { AUTOSAVE_ID, type SlotSummary } from './save-slots';
import type { TitleSaves } from './title-menu';

const slot = (
  id: number,
  savedAt: number | null,
  loadable = true
): SlotSummary => ({
  gameDate: 'Day 1',
  id,
  loadable,
  name: id === AUTOSAVE_ID ? 'Autosave' : `Save ${id}`,
  savedAt
});

const SAVES: TitleSaves = {
  autosave: slot(AUTOSAVE_ID, 300),
  slots: [slot(1, 100), slot(2, 500, false)]
};

const keys = (menu: GameMenu, ...pressed: string[]): GameMenuStep => {
  let step: GameMenuStep = { menu };
  for (const key of pressed) {
    if (step.choice) {
      break;
    }
    step = pressGameMenuKey(step.menu, key, SAVES);
  }
  return step;
};

const labels = (menu: GameMenu): string[] =>
  gameMenuView(menu).rows.map(row => row.label);

const centre = (menu: GameMenu, row: number) => {
  const r = layoutMenu(gameMenuView(menu)).rows[row]!;
  return { x: r.x + 4, y: r.y + r.height / 2 };
};

describe('the in-game menu', () => {
  test('offers Save, Load, Return to title, the Map setting and Close', () => {
    expect(labels(openGameMenu())).toEqual([
      'Save',
      'Load',
      'Return to title',
      'Map: Classic',
      'Close'
    ]);
  });

  test('shows the Map setting and chooses to switch it', () => {
    const menu = {
      kind: 'main' as const,
      mapStyle: 'atlas' as const,
      selected: 0
    };
    expect(labels(menu)[3]).toBe('Map: Atlas');
    expect(keys(menu, 'ArrowUp', 'ArrowUp', 'Enter').choice).toEqual({
      kind: 'map-style'
    });
  });

  test('Escape or Close closes it', () => {
    expect(keys(openGameMenu(), 'Escape').choice).toEqual({ kind: 'close' });
    expect(keys(openGameMenu(), 'ArrowUp', 'Enter').choice).toEqual({
      kind: 'close'
    });
  });

  test('Return to title is chosen at once', () => {
    expect(keys(openGameMenu(), 'ArrowDown', 'ArrowDown', ' ').choice).toEqual({
      kind: 'title'
    });
  });

  test('Save lists a new save, then the named slots newest first', () => {
    const list = keys(openGameMenu(), 'Enter').menu;
    expect(labels(list)).toEqual(['New save', 'Save 2', 'Save 1', 'Back']);
  });

  test('a new save is named by typing', () => {
    const naming = keys(openGameMenu(), 'Enter', 'Enter').menu;
    expect(naming.kind).toBe('name');
    const typed = keys(
      naming,
      'B',
      'r',
      'e',
      'e',
      'x',
      'Backspace',
      ' ',
      'Enter'
    );
    expect(typed.choice).toEqual({ kind: 'save-new', name: 'Bree ' });
    expect(gameMenuView(keys(naming, 'A').menu).lines[1]).toBe('A|');
  });

  test('a name stops at its limit', () => {
    const naming = keys(openGameMenu(), 'Enter', 'Enter').menu;
    const long = keys(naming, ...Array.from({ length: 30 }, () => 'x'));
    expect(long.menu).toMatchObject({ text: 'x'.repeat(NAME_LIMIT) });
  });

  test('Escape while naming goes back without saving', () => {
    const naming = keys(openGameMenu(), 'Enter', 'Enter').menu;
    const back = keys(naming, 'a', 'Escape');
    expect(back.choice).toBeUndefined();
    expect(back.menu.kind).toBe('main');
  });

  test('saving over a slot asks first, defaulting to no', () => {
    const asked = keys(
      openGameMenu(),
      'Enter',
      'ArrowDown',
      'ArrowDown',
      'Enter'
    );
    expect(asked.menu).toMatchObject({
      action: 'save-over',
      kind: 'confirm',
      selected: 1
    });
    expect(keys(asked.menu, 'Enter').menu.kind).toBe('main');
    expect(keys(asked.menu, 'ArrowUp', 'Enter').choice).toEqual({
      id: 1,
      kind: 'save-over'
    });
  });

  test('Load lists the autosave first, asks, then loads', () => {
    const list = keys(openGameMenu(), 'ArrowDown', 'Enter').menu;
    expect(labels(list)).toEqual(['Autosave', 'Save 2', 'Save 1', 'Back']);
    const asked = keys(list, 'Enter').menu;
    expect(asked.kind).toBe('confirm');
    expect(keys(asked, 'ArrowUp', 'Enter').choice).toEqual({
      id: AUTOSAVE_ID,
      kind: 'load'
    });
  });

  test('a save from another version is refused', () => {
    const list = keys(openGameMenu(), 'ArrowDown', 'Enter').menu;
    const refused = keys(list, 'ArrowDown', 'Enter');
    expect(refused.choice).toBeUndefined();
    expect(refused.menu.kind).toBe('message');
    expect(keys(refused.menu, 'x').menu.kind).toBe('main');
  });

  test('a click chooses the row under it, and hovering selects', () => {
    const menu = openGameMenu();
    expect(hoverGameMenu(menu, centre(menu, 2))).toMatchObject({
      selected: 2
    });
    expect(clickGameMenu(menu, centre(menu, 4), SAVES).choice).toEqual({
      kind: 'close'
    });
    expect(clickGameMenu(menu, { x: 0, y: 0 }, SAVES).menu).toBe(menu);
  });
});
