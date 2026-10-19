import { describe, expect, test } from 'bun:test';

import { archiveButtonAt, archiveMenu, archiveMessage } from './archive-window';

describe('archive window', () => {
  test('offers restore above save, as the original does', () => {
    const menu = archiveMenu();
    expect(menu.kind === 'menu' && menu.buttons.map(b => b.label)).toEqual([
      'Restore an old game',
      'Save current game'
    ]);
  });

  test('finds the button under a point, and none on a message', () => {
    const menu = archiveMenu();
    if (menu.kind !== 'menu') {
      throw new Error('expected a menu');
    }
    const [restore, save] = menu.buttons;
    expect(
      archiveButtonAt(menu, { x: save!.x + 1, y: save!.y + 1 })?.choice
    ).toBe('save');
    expect(
      archiveButtonAt(menu, { x: restore!.x + 1, y: restore!.y + 1 })?.choice
    ).toBe('restore');
    expect(archiveButtonAt(menu, { x: 0, y: 0 })).toBeUndefined();
    expect(
      archiveButtonAt(archiveMessage(['x']), { x: save!.x + 1, y: save!.y + 1 })
    ).toBeUndefined();
  });
});
