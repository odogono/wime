import { describe, expect, test } from 'bun:test';

import {
  createSim,
  findFight,
  startFight,
  startMeeting,
  type RosterEntry,
  type SimState
} from '../sim/index';
import {
  NO_MESSAGES,
  closeMessage,
  mayReplace,
  openBox,
  stepBox,
  stepMessages,
  timedOut,
  type BoxLevel,
  type MessageContext,
  type MessageWorld
} from './message-box';
import { FIXED_FONT } from './test-font';
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

// The game's messages through the interface the view plays them with,
// on synthetic rosters with the entries at their real indices.
const entry = (
  index: number,
  name: string,
  over: Partial<RosterEntry> = {}
): RosterEntry => ({
  allegiance: 99,
  destination: null,
  encounter: null,
  facing: 0,
  fighting: 2,
  figure: 0,
  fraction: 0,
  health: 1,
  icon: 0,
  index,
  isUnit: false,
  leader: null,
  maxHealth: 1,
  maxStamina: 40,
  name,
  objects: [],
  position: { x: 1360, y: 960 },
  route: 0,
  speed: 2,
  stamina: 40,
  startingStrength: 1,
  state: 1,
  strength: 1,
  ticked: true,
  trigger: { kind: 'none' },
  triggerByte: 0,
  unknown: { b19: 0, b24: 0, b29: 0 },
  ...over
});

const withRoster = (entries: RosterEntry[]): SimState => ({
  ...createSim(1),
  roster: Array.from(
    { length: 196 },
    (_, index) =>
      entries.find(candidate => candidate.index === index) ??
      entry(index, '', { position: null, state: 0 })
  )
});

// Faramir passes Eomer, then meets him, and a War Event is announced,
// all raised within one tick.
const passingMeetingAndWar = (): SimState => {
  const sim = startMeeting(
    withRoster([entry(15, 'FARAMIR'), entry(13, 'EOMER')]),
    { a: 15, b: 13, kind: 'follow' }
  );
  return {
    ...sim,
    announcements: [{ day: 0, event: 4 }],
    passings: [{ a: 15, b: 13 }]
  };
};

// Infantry meet orcs, a fight to announce.
const aFight = (): SimState => {
  const at = { x: 1296, y: 1168 };
  const sim = withRoster([
    entry(73, 'infantry', {
      isUnit: true,
      position: at,
      startingStrength: 1000,
      strength: 1000
    }),
    entry(141, 'orcs', {
      allegiance: 0,
      isUnit: true,
      position: at,
      startingStrength: 500,
      strength: 500
    })
  ]);
  const found = findFight(sim, 73);
  if (!found) {
    throw new Error('no fight');
  }
  return startFight(sim, found);
};

const context = (
  frame: number,
  level: BoxLevel = 'campaign'
): MessageContext => ({
  choose: () => 0,
  font: FIXED_FONT,
  level,
  now: frames(frame),
  speed: 'normal'
});

const playing = (sim: SimState): MessageWorld => ({
  messages: { ...NO_MESSAGES },
  sim
});

describe("the game's messages", () => {
  test('a pass-by, a meeting and a War Event raised at once open in turn, each waiting out the one before', () => {
    const first = stepMessages(playing(passingMeetingAndWar()), context(0));
    expect(first.messages.passing?.text).toBe('FARAMIR passes EOMER.');
    expect(first.messages.box?.kind).toBe('passing');
    expect(first.sim.passings).toEqual([]);
    expect(first.messages.waiting).toBe(true);
    expect(first.decision).toBe(false);

    const held = stepMessages(first, context(199));
    expect(held.messages.box?.kind).toBe('passing');
    expect(held.messages.waiting).toBe(true);
    expect(held.resumed).toBe(false);

    const meeting = stepMessages(held, context(200));
    expect(meeting.messages.passing).toBeNull();
    expect(meeting.messages.box?.kind).toBe('meeting');
    expect(meeting.messages.box?.buttons).toBe(true);
    expect(meeting.decision).toBe(true);
    // The War Event waits on the meeting window in turn.
    expect(meeting.messages.waiting).toBe(true);
    expect(meeting.sim.announcements).toHaveLength(1);

    // The meeting window's deadline answers "Continue on" and the War
    // Event replaces it.
    const war = stepMessages(meeting, context(200 + 720));
    expect(war.sim.meeting).toBeNull();
    expect(war.messages.meeting).toBeNull();
    expect(war.messages.box?.kind).toBe('war');
    expect(war.messages.war?.event).toBe(4);
    expect(war.sim.announcements).toEqual([]);
    expect(war.messages.waiting).toBe(false);
    expect(war.resumed).toBe(true);
  });

  test('a fight\'s announcement answers "Ignore it" at its deadline and opens the fight\'s boxes', () => {
    const announced = stepMessages(playing(aFight()), context(0));
    expect(announced.messages.combat?.kind).toBe('announcement');
    expect(announced.messages.box).toMatchObject({
      buttons: true,
      kind: 'fight'
    });
    expect(announced.decision).toBe(true);

    const ignored = stepMessages(announced, context(720));
    expect(ignored.messages.combat?.kind).toBe('boxes');
    expect(ignored.messages.box).toMatchObject({
      buttons: false,
      kind: 'fight',
      ref: ignored.messages.combat
    });
    expect(ignored.sim.fight).toBeNull();
  });

  test('leaving a Level closes the open box, pressing its default', () => {
    const meeting = stepMessages(
      playing(
        startMeeting(withRoster([entry(15, 'FARAMIR'), entry(13, 'EOMER')]), {
          a: 15,
          b: 13,
          kind: 'follow'
        })
      ),
      context(0)
    );
    expect(meeting.messages.box?.kind).toBe('meeting');
    const left = closeMessage(meeting, context(10));
    expect(left.messages.box).toBeNull();
    expect(left.messages.meeting).toBeNull();
    expect(left.sim.meeting).toBeNull();
  });

  test('nothing opens on the Full Map Level, nor while the view holds the game', () => {
    const sim = passingMeetingAndWar();
    const fullMap = stepMessages(playing(sim), context(0, 'full-map'));
    expect(fullMap.messages.box).toBeNull();
    expect(fullMap.sim).toBe(sim);
    const held = stepMessages(playing(sim), context(0), true);
    expect(held.messages.box).toBeNull();
  });

  test("the Animation Level shows Gandalf's letter before the game's messages", () => {
    const world: MessageWorld = {
      messages: { ...NO_MESSAGES, letter: { kind: 'pending' } },
      sim: passingMeetingAndWar()
    };
    const step = stepMessages(world, context(0, 'animation'));
    expect(step.messages.letter).toEqual({ kind: 'open' });
    expect(step.messages.box?.kind).toBe('letter');
    expect(step.messages.waiting).toBe(true);
    expect(step.sim.passings).toHaveLength(1);
  });
});
