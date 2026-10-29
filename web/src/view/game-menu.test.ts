import { describe, expect, test } from 'bun:test';

import { NO_DEBUG_VIEWS } from './debug-views';
import {
  NAME_LIMIT,
  clickGameMenu,
  gameMenuView,
  hoverGameMenu,
  openEndedMenu,
  openGameMenu,
  openSettingsMenu,
  pressGameMenuKey,
  type GameMenu,
  type GameMenuStep
} from './game-menu';
import { layoutMenu } from './menu-window';
import { AUTOSAVE_ID, type SlotSummary } from './save-slots';
import { loadList, type TitleSaves } from './title-menu';

const slot = (
  id: number,
  savedAt: number | null,
  loadable = true
): SlotSummary => ({
  gameDate: 'Day 1',
  id,
  loadable,
  movementRule: 'classic',
  name: id === AUTOSAVE_ID ? 'Autosave' : `Save ${id}`,
  savedAt,
  setupSeed: null
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

const load = (slots: SlotSummary[], selected: number): GameMenu => ({
  kind: 'load',
  selected,
  slots
});

const centre = (menu: GameMenu, row: number) => {
  const r = layoutMenu(gameMenuView(menu)).rows[row]!;
  return { x: r.x + 4, y: r.y + r.height / 2 };
};

describe('the in-game menu', () => {
  test('offers Save, Load, Settings, Return to title and Close', () => {
    expect(labels(openGameMenu())).toEqual([
      'Save',
      'Load',
      'Settings',
      'Return to title',
      'Close'
    ]);
  });

  test('a Shuffled Setup is named over it, a Classic Setup not', () => {
    expect(gameMenuView(openGameMenu()).lines).toEqual([]);
    const shuffled = gameMenuView(openGameMenu(false, 1234));
    expect(shuffled.lines).toEqual(['Shuffled Setup 1234']);
    expect(shuffled.rows.map(row => row.label)).toEqual(labels(openGameMenu()));
    expect(gameMenuView(openEndedMenu(false, 7)).lines).toEqual([
      'Shuffled Setup 7'
    ]);
  });

  test('the Load list names a Shuffled save’s Setup when there is one', () => {
    const shuffled = { ...slot(4, 900), setupSeed: 99 };
    const classic = loadList(SAVES);
    expect(gameMenuView(load(classic, 0)).lines).toEqual([]);
    const mixed = [shuffled, ...classic];
    expect(gameMenuView(load(mixed, 0)).lines).toEqual(['Shuffled Setup 99']);
    // The line stays, blank, so the window keeps its height.
    expect(gameMenuView(load(mixed, 1)).lines).toEqual(['']);
  });

  test('the Load list names a Crossing movement save’s rule', () => {
    const crossing = { ...slot(4, 900), movementRule: 'crossing' as const };
    const mixed = [crossing, ...loadList(SAVES)];
    expect(gameMenuView(load(mixed, 0)).lines).toEqual(['Crossing movement']);
    expect(gameMenuView(load(mixed, 1)).lines).toEqual(['']);
    const both = [{ ...crossing, setupSeed: 99 }, ...loadList(SAVES)];
    expect(gameMenuView(load(both, 0)).lines).toEqual([
      'Shuffled Setup 99',
      'Crossing movement'
    ]);
  });

  test('Escape or Close closes it', () => {
    expect(keys(openGameMenu(), 'Escape').choice).toEqual({ kind: 'close' });
    expect(keys(openGameMenu(), 'ArrowUp', 'Enter').choice).toEqual({
      kind: 'close'
    });
  });

  test('Return to title is chosen at once', () => {
    expect(keys(openGameMenu(), 'ArrowUp', 'ArrowUp', ' ').choice).toEqual({
      kind: 'title'
    });
  });

  test('Settings is asked for, and opens with what holds now', () => {
    expect(
      keys(openGameMenu(), 'ArrowDown', 'ArrowDown', 'Enter').choice
    ).toEqual({ kind: 'settings' });
    expect(
      labels(
        openSettingsMenu({
          debug: NO_DEBUG_VIEWS,
          glassShowsEvil: false,
          map: 'classic',
          size: 0.75,
          sound: false
        })
      )
    ).toEqual([
      'Sound: Off',
      'Window size: 75%',
      'Glass shows Evil: Off',
      'Map: Classic',
      'Back'
    ]);
  });

  test('Settings switches sound, steps the window size and switches the glass', () => {
    const open = openSettingsMenu({
      debug: NO_DEBUG_VIEWS,
      glassShowsEvil: false,
      map: 'classic',
      size: 1,
      sound: true
    });
    const sound = keys(open, 'Enter');
    expect(sound.choice).toEqual({
      kind: 'set',
      settings: {
        debug: NO_DEBUG_VIEWS,
        glassShowsEvil: false,
        map: 'classic',
        size: 1,
        sound: false
      }
    });
    expect(labels(sound.menu)[0]).toBe('Sound: Off');
    let menu = keys(open, 'ArrowDown').menu;
    const sizes: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      const step = pressGameMenuKey(menu, 'Enter', SAVES);
      sizes.push(step.choice?.kind === 'set' && step.choice.settings.size);
      menu = step.menu;
    }
    expect(sizes).toEqual([0.75, 0.5, 1]);
    const glass = keys(open, 'ArrowDown', 'ArrowDown', 'Enter');
    expect(glass.choice).toEqual({
      kind: 'set',
      settings: {
        debug: NO_DEBUG_VIEWS,
        glassShowsEvil: true,
        map: 'classic',
        size: 1,
        sound: true
      }
    });
    expect(labels(glass.menu)[2]).toBe('Glass shows Evil: On');
    expect(keys(open, 'ArrowUp', 'Enter').menu).toEqual(openGameMenu());
    expect(keys(open, 'Escape').menu).toEqual(openGameMenu());
  });

  test('Settings switches the map between Classic and Atlas', () => {
    const open = openSettingsMenu({
      debug: NO_DEBUG_VIEWS,
      glassShowsEvil: false,
      map: 'classic',
      size: 1,
      sound: true
    });
    const map = keys(open, 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter');
    expect(map.choice?.kind === 'set' ? map.choice.settings.map : null).toBe(
      'atlas'
    );
    expect(labels(map.menu)[3]).toBe('Map: Atlas');
  });

  test('Debug views are offered only where allowed, each a switch', () => {
    const plain = {
      debug: NO_DEBUG_VIEWS,
      glassShowsEvil: false,
      map: 'classic',
      size: 1,
      sound: true
    } as const;
    expect(labels(openSettingsMenu(plain))).not.toContain('Debug views');
    const open = openSettingsMenu(plain, true);
    const debug = keys(
      open,
      'ArrowDown',
      'ArrowDown',
      'ArrowDown',
      'ArrowDown',
      'Enter'
    ).menu;
    expect(labels(debug)).toEqual([
      'Terrain: Off',
      'Paths: Off',
      'Encounter areas: Off',
      'Force labels: Off',
      'Pointer info: Off',
      'Back'
    ]);
    const paths = keys(debug, 'ArrowDown', 'Enter');
    expect(paths.choice).toEqual({
      kind: 'set',
      settings: { ...plain, debug: { ...NO_DEBUG_VIEWS, paths: true } }
    });
    expect(labels(paths.menu)[1]).toBe('Paths: On');
    expect(keys(debug, 'Escape').menu).toEqual(open);
    expect(keys(debug, 'ArrowUp', 'Enter').menu).toEqual(open);
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

describe('the menu after the ending', () => {
  const ended = openEndedMenu();
  const endedKeys = (...pressed: string[]): GameMenuStep => {
    let step: GameMenuStep = { menu: ended };
    for (const key of pressed) {
      if (step.choice) {
        break;
      }
      step = pressGameMenuKey(step.menu, key, SAVES, ended);
    }
    return step;
  };

  test('offers only Return to title and Load', () => {
    expect(labels(ended)).toEqual(['Return to title', 'Load']);
  });

  test('Return to title is chosen at once', () => {
    expect(endedKeys('Enter').choice).toEqual({ kind: 'title' });
  });

  test('Escape does not close it', () => {
    expect(endedKeys('Escape')).toEqual({ menu: ended });
  });

  test('Load opens the slots, and backing out returns to it', () => {
    const load = endedKeys('ArrowDown', 'Enter').menu;
    expect(load.kind).toBe('load');
    expect(endedKeys('ArrowDown', 'Enter', 'Escape').menu).toEqual(ended);
    expect(endedKeys('ArrowDown', 'Enter', 'ArrowUp', 'Enter').menu).toEqual(
      ended
    );
    const back = centre(load, labels(load).length - 1);
    expect(clickGameMenu(load, back, SAVES, ended).menu).toEqual(ended);
    // Going back from the question to load also returns to it.
    expect(endedKeys('ArrowDown', 'Enter', 'Enter', 'Enter').menu).toEqual(
      ended
    );
    expect(
      endedKeys('ArrowDown', 'Enter', 'Enter', 'ArrowUp', 'Enter').choice
    ).toEqual({ id: AUTOSAVE_ID, kind: 'load' });
  });
});

describe('the menus in a chosen Demo', () => {
  test('the in-game menu offers only Resume, Settings and Return to title', () => {
    const menu = openGameMenu(true);
    expect(labels(menu)).toEqual(['Resume', 'Settings', 'Return to title']);
    expect(pressGameMenuKey(menu, 'Enter', SAVES, menu).choice).toEqual({
      kind: 'close'
    });
    expect(pressGameMenuKey(menu, 'Escape', SAVES, menu).choice).toEqual({
      kind: 'close'
    });
    const down = pressGameMenuKey(menu, 'ArrowDown', SAVES, menu).menu;
    expect(pressGameMenuKey(down, 'Enter', SAVES, menu).choice).toEqual({
      kind: 'settings'
    });
    const last = pressGameMenuKey(menu, 'ArrowUp', SAVES, menu).menu;
    expect(pressGameMenuKey(last, 'Enter', SAVES, menu).choice).toEqual({
      kind: 'title'
    });
  });

  test('after the ending only Return to title, which Escape does not close', () => {
    const ended = openEndedMenu(true);
    expect(labels(ended)).toEqual(['Return to title']);
    expect(pressGameMenuKey(ended, 'Enter', SAVES, ended).choice).toEqual({
      kind: 'title'
    });
    expect(pressGameMenuKey(ended, 'Escape', SAVES, ended)).toEqual({
      menu: ended
    });
  });
});
