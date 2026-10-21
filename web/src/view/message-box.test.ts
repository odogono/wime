import { describe, expect, test } from 'bun:test';

import {
  mayReplace,
  openBox,
  stepBox,
  timedOut,
  type BoxLevel
} from './message-box';
import { FRAME_MS, type GameSpeed } from './tick-driver';

// The one message box (finding:ui-message-box-opening-waits-for-the-open-box,
// finding:ui-message-box-timeouts-by-level).
const frames = (n: number): number => n * FRAME_MS;
const plain = (
  now: number,
  level: BoxLevel = 'campaign',
  speed: GameSpeed = 'normal'
) => openBox('war', {}, false, now, level, speed);
const withButtons = (now: number, level: BoxLevel = 'campaign') =>
  openBox('meeting', {}, true, now, level, 'normal');

describe('the message box', () => {
  test('a box without buttons may be replaced after 200 frames, 60 on Very Hasty', () => {
    expect(plain(1000).deadline).toBe(1000 + frames(200));
    expect(plain(1000, 'campaign', 'hasty').deadline).toBe(1000 + frames(200));
    expect(plain(1000, 'campaign', 'very-hasty').deadline).toBe(
      1000 + frames(60)
    );
  });

  test('a box raised before the deadline waits, holding the game, then replaces the open box', () => {
    const open = plain(0);
    expect(stepBox(open, frames(199), 'campaign', true)).toEqual({
      close: false,
      open: false,
      waiting: true
    });
    expect(stepBox(open, frames(200), 'campaign', true)).toEqual({
      close: true,
      open: true,
      waiting: false
    });
    // With no box open, a raised box opens at once.
    expect(stepBox(null, 0, 'campaign', true)).toEqual({
      close: false,
      open: true,
      waiting: false
    });
  });

  test('boxes open in the order raised, each waiting out the one before', () => {
    // Three boxes raised at once open at 0, 200 and 400 frames.
    const raised = ['passing', 'war', 'war'];
    const opened: number[] = [];
    let box: ReturnType<typeof plain> | null = null;
    for (let frame = 0; frame <= 1000 && raised.length > 0; frame++) {
      const now = frames(frame);
      const step = stepBox(box, now, 'campaign', true);
      if (step.open) {
        raised.shift();
        opened.push(frame);
        box = plain(now);
      }
    }
    expect(opened).toEqual([0, 200, 400]);
  });

  test('a box without buttons lasts 1,220 frames on the Campaign Level and 1,500 on the Animation Level', () => {
    const campaign = plain(0);
    expect(timedOut(campaign, frames(1219), 'campaign')).toBe(false);
    expect(timedOut(campaign, frames(1220), 'campaign')).toBe(true);
    const animation = plain(0, 'animation');
    expect(timedOut(animation, frames(1499), 'animation')).toBe(false);
    expect(timedOut(animation, frames(1500), 'animation')).toBe(true);
    expect(stepBox(animation, frames(1500), 'animation', false)).toEqual({
      close: true,
      open: false,
      waiting: false
    });
  });

  test('on Very Hasty, 1,080 and 1,360 frames', () => {
    const campaign = plain(0, 'campaign', 'very-hasty');
    expect(timedOut(campaign, frames(1079), 'campaign')).toBe(false);
    expect(timedOut(campaign, frames(1080), 'campaign')).toBe(true);
    const animation = plain(0, 'animation', 'very-hasty');
    expect(timedOut(animation, frames(1359), 'animation')).toBe(false);
    expect(timedOut(animation, frames(1360), 'animation')).toBe(true);
  });

  test('a box with buttons times out, its default pressed, at 720 frames on the Campaign Level and 1,020 on the Animation Level', () => {
    const campaign = withButtons(0);
    expect(campaign.deadline).toBe(frames(720));
    expect(timedOut(campaign, frames(719), 'campaign')).toBe(false);
    expect(timedOut(campaign, frames(720), 'campaign')).toBe(true);
    const animation = withButtons(0, 'animation');
    expect(animation.deadline).toBe(frames(1020));
    expect(timedOut(animation, frames(1020), 'animation')).toBe(true);
  });

  test('on the Full Map Level no box times out', () => {
    expect(timedOut(plain(0), frames(100_000), 'full-map')).toBe(false);
    expect(timedOut(withButtons(0), frames(100_000), 'full-map')).toBe(false);
  });

  test('a later box replaces one without buttons only after its deadline', () => {
    const open = plain(0);
    expect(mayReplace(open, frames(199))).toBe(false);
    expect(mayReplace(open, frames(200))).toBe(true);
    expect(mayReplace(null, 0)).toBe(true);
  });

  test('with nothing raised, the open box stays until it times out', () => {
    expect(stepBox(plain(0), frames(500), 'campaign', false)).toEqual({
      close: false,
      open: false,
      waiting: false
    });
    expect(stepBox(null, 0, 'campaign', false)).toEqual({
      close: false,
      open: false,
      waiting: false
    });
  });
});
