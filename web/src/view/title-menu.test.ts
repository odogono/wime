import { describe, expect, test } from 'bun:test';

import { LIST_ROWS } from './menu-window';
import { AUTOSAVE_ID, type SlotSummary } from './save-slots';
import {
  clickTitleMenu,
  hoverTitleMenu,
  latestSave,
  layoutTitleMenu,
  openTitleMenu,
  pressTitleMenuKey,
  type TitleMenu,
  type TitleSaves
} from './title-menu';

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

const NONE: TitleSaves = { autosave: null, slots: [] };
const SOME: TitleSaves = {
  autosave: slot(AUTOSAVE_ID, 300),
  slots: [slot(1, 100), slot(2, 500), slot(3, null)]
};

const keys = (menu: TitleMenu, saves: TitleSaves, ...pressed: string[]) => {
  let step: ReturnType<typeof pressTitleMenuKey> = { menu };
  for (const key of pressed) {
    if (step.choice) {
      break;
    }
    step = pressTitleMenuKey(step.menu, key, saves);
  }
  return step;
};

const centre = (menu: TitleMenu, row: number) => {
  const r = layoutTitleMenu(menu).rows[row]!;
  return { x: r.x + 4, y: r.y + r.height / 2 };
};

describe('latestSave', () => {
  test('is the newest loadable save, autosave or named', () => {
    expect(latestSave(SOME)?.id).toBe(2);
    expect(latestSave({ ...SOME, slots: [slot(2, 500, false)] })?.id).toBe(
      AUTOSAVE_ID
    );
  });

  test('counts a save with no time as the oldest', () => {
    expect(latestSave({ autosave: null, slots: [slot(3, null)] })?.id).toBe(3);
    expect(
      latestSave({ autosave: null, slots: [slot(3, null), slot(4, 1)] })?.id
    ).toBe(4);
  });

  test('is null with nothing loadable', () => {
    expect(latestSave(NONE)).toBeNull();
    expect(
      latestSave({ autosave: null, slots: [slot(1, 9, false)] })
    ).toBeNull();
  });
});

describe('the title menu', () => {
  test('offers Resume only when there is a save to resume', () => {
    expect(layoutTitleMenu(openTitleMenu(SOME)).rows.map(r => r.label)).toEqual(
      ['Resume', 'New Game', 'Load']
    );
    expect(layoutTitleMenu(openTitleMenu(NONE)).rows.map(r => r.label)).toEqual(
      ['New Game', 'Load']
    );
  });

  test('Resume loads the newest save', () => {
    expect(keys(openTitleMenu(SOME), SOME, 'Enter').choice).toEqual({
      id: 2,
      kind: 'resume'
    });
  });

  test('New Game starts at once with no save', () => {
    expect(keys(openTitleMenu(NONE), NONE, 'Enter').choice).toEqual({
      kind: 'new-game'
    });
  });

  test('New Game asks first when there is a save, defaulting to no', () => {
    const asked = keys(openTitleMenu(SOME), SOME, 'ArrowDown', 'Enter');
    expect(asked.choice).toBeUndefined();
    expect(asked.menu.kind).toBe('confirm');
    expect(keys(asked.menu, SOME, 'Enter').menu.kind).toBe('main');
    expect(keys(asked.menu, SOME, 'ArrowUp', 'Enter').choice).toEqual({
      kind: 'new-game'
    });
    expect(keys(asked.menu, SOME, 'Escape').menu.kind).toBe('main');
  });

  test('the arrows wrap', () => {
    expect(keys(openTitleMenu(SOME), SOME, 'ArrowUp').menu).toMatchObject({
      selected: 2
    });
  });

  test('Load lists the autosave, then the slots newest first, then Back', () => {
    const list = keys(openTitleMenu(SOME), SOME, 'ArrowUp', 'Enter').menu;
    expect(layoutTitleMenu(list).rows.map(r => r.label)).toEqual([
      'Autosave',
      'Save 2',
      'Save 1',
      'Save 3',
      'Back'
    ]);
    expect(keys(list, SOME, 'ArrowDown', 'Enter').choice).toEqual({
      id: 2,
      kind: 'load'
    });
    expect(keys(list, SOME, 'ArrowUp', 'Enter').menu.kind).toBe('main');
  });

  test('a save from another version is refused with a message', () => {
    const saves = { autosave: null, slots: [slot(1, 1, false)] };
    const list = keys(openTitleMenu(saves), saves, 'ArrowDown', 'Enter').menu;
    const refused = keys(list, saves, 'Enter');
    expect(refused.choice).toBeUndefined();
    expect(refused.menu.kind).toBe('message');
    expect(keys(refused.menu, saves, 'x').menu.kind).toBe('main');
  });

  test('a long Load list scrolls to keep the selected row in view', () => {
    const many = {
      autosave: null,
      slots: Array.from({ length: 10 }, (_, i) => slot(i + 1, i))
    };
    const list = keys(openTitleMenu(many), many, 'ArrowUp', 'Enter').menu;
    expect(layoutTitleMenu(list).rows).toHaveLength(LIST_ROWS);
    const last = keys(list, many, 'ArrowUp').menu;
    expect(layoutTitleMenu(last).rows.at(-1)!.label).toBe('Back');
    expect(keys(last, many, 'Enter').menu.kind).toBe('main');
  });

  test('a click chooses the row under it, and hovering selects', () => {
    const menu = openTitleMenu(SOME);
    expect(hoverTitleMenu(menu, centre(menu, 2))).toMatchObject({
      selected: 2
    });
    expect(clickTitleMenu(menu, centre(menu, 0), SOME).choice).toEqual({
      id: 2,
      kind: 'resume'
    });
    expect(clickTitleMenu(menu, { x: 0, y: 0 }, SOME).menu).toBe(menu);
  });

  test('a click in a scrolled list picks the row on show', () => {
    const many = {
      autosave: null,
      slots: Array.from({ length: 10 }, (_, i) => slot(i + 1, i))
    };
    const list = keys(
      openTitleMenu(many),
      many,
      'ArrowUp',
      'Enter',
      'ArrowUp'
    ).menu;
    expect(clickTitleMenu(list, centre(list, 0), many).choice).toEqual({
      id: 5,
      kind: 'load'
    });
  });
});
