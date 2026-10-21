import { describe, expect, test } from 'bun:test';

import {
  BOOT_FRAMES,
  CREDITS_FRAMES,
  VERSE_HOLD_FRAMES,
  bootSequence,
  bootView,
  fadeComponent,
  pressBootKey,
  startBoot,
  stepBoot,
  type BootSequence
} from './boot-sequence';
import { FRAME_MS } from './tick-driver';

// Times in frames after Title starts, at 1000 ms.
const START = 1000;
const at = (frame: number): number => START + frame * FRAME_MS;
const started = (): BootSequence => startBoot(bootSequence(0), START).boot;
// When the Ring verse goes up after an unbroken sequence: the Credits
// end, then the title screen fades out over 30 frames.
const VERSE = BOOT_FRAMES.credits + CREDITS_FRAMES + 30;

describe('the boot sequence', () => {
  test('waits on the Melbourne House screen for the first input', () => {
    const boot = bootSequence(0);
    expect(bootView(boot, 0)).toMatchObject({
      fade: { kind: 'in', step: 0 },
      picture: 'melbourneHouse'
    });
    expect(bootView(boot, 10_000)).toMatchObject({
      fade: null,
      picture: 'melbourneHouse'
    });
    expect(stepBoot(boot, 10_000, false)).toBe(boot);
  });

  test('the first input starts it and skips nothing', () => {
    const first = startBoot(bootSequence(0), START);
    expect(first.started).toBe(true);
    expect(startBoot(first.boot, at(5)).started).toBe(false);
    const keyed = pressBootKey(bootSequence(0), START);
    expect(keyed).toMatchObject({ done: false, kept: null, startedAt: START });
  });

  test('shows each screen on the timetable', () => {
    const boot = started();
    const view = (frame: number) => bootView(boot, at(frame));
    expect(view(100)).toMatchObject({ fade: null, picture: 'melbourneHouse' });
    expect(view(240)).toMatchObject({
      fade: { kind: 'out', step: 1 },
      picture: 'melbourneHouse'
    });
    expect(view(270)).toMatchObject({
      fade: { kind: 'in', step: 0 },
      picture: 'synergistic'
    });
    expect(view(400)).toMatchObject({ fade: null, picture: 'synergistic' });
    expect(view(570)).toMatchObject({ logoY: null, picture: 'title' });
    expect(view(600)).toMatchObject({ logoY: 20, picture: 'title' });
    expect(view(999)).toMatchObject({ creditsStep: null, logoY: 20 });
    expect(view(1000)).toMatchObject({ creditsStep: 0, logoY: 20 });
    // The logo rises with the Credits from their 16th step.
    const step20 = 1000 + Math.ceil((20 * CREDITS_FRAMES) / 600);
    expect(view(step20)).toMatchObject({ creditsStep: 20, logoY: 15 });
    expect(view(VERSE - 1)).toMatchObject({
      creditsStep: 600,
      fade: { kind: 'out', step: 15 }
    });
    expect(view(VERSE)).toMatchObject({ picture: null, verse: true });
  });

  test('holds the Ring verse until Title ends', () => {
    const boot = started();
    const shown = stepBoot(boot, at(VERSE), true);
    expect(shown).toMatchObject({ done: false, verseAt: VERSE });
    expect(stepBoot(shown, at(VERSE + 3000), true).done).toBe(false);
    expect(stepBoot(shown, at(VERSE + 3000), false).done).toBe(true);
    // Keys do nothing once it is up.
    expect(pressBootKey(shown, at(VERSE + 10))).toBe(shown);
  });

  test('holds the Ring verse a while even when Title has ended', () => {
    const shown = stepBoot(started(), at(VERSE), false);
    expect(shown.done).toBe(false);
    expect(stepBoot(shown, at(VERSE + VERSE_HOLD_FRAMES), false).done).toBe(
      true
    );
  });

  test('a key before the logo skips the rest', () => {
    const boot = pressBootKey(started(), at(300));
    expect(boot).toMatchObject({ done: true, kept: 'all' });
  });

  test('a key while the logo shows skips the Credits and Title', () => {
    const boot = pressBootKey(started(), at(700));
    expect(boot.kept).toBe('credits');
    expect(bootView(boot, at(710))).toMatchObject({
      creditsStep: null,
      fade: { kind: 'out', step: 6 }
    });
    const shown = stepBoot(boot, at(730), true);
    expect(bootView(shown, at(730)).verse).toBe(true);
    expect(stepBoot(shown, at(730 + VERSE_HOLD_FRAMES), true).done).toBe(true);
  });

  test('a key during the Credits ends them but Title still holds', () => {
    const boot = pressBootKey(started(), at(1500));
    expect(boot.kept).toBeNull();
    const shown = stepBoot(boot, at(1530), true);
    expect(bootView(shown, at(1530)).verse).toBe(true);
    expect(stepBoot(shown, at(1530 + VERSE_HOLD_FRAMES), true).done).toBe(
      false
    );
  });
});

describe('fades', () => {
  test('a fade out takes a step from each component', () => {
    expect(fadeComponent(15, { kind: 'out', step: 3 })).toBe(12);
    expect(fadeComponent(2, { kind: 'out', step: 3 })).toBe(0);
  });

  test('a fade in brings each component up from black', () => {
    expect(fadeComponent(15, { kind: 'in', step: 3 })).toBe(3);
    expect(fadeComponent(2, { kind: 'in', step: 3 })).toBe(2);
    expect(fadeComponent(9, null)).toBe(9);
  });
});
