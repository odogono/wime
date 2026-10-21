import { describe, expect, test } from 'bun:test';

import {
  createSim,
  restoreSave,
  serialiseSave,
  startMeeting,
  tickSim,
  type Meeting,
  type RosterEntry,
  type SimState
} from '../sim/index';
import {
  GOLLUM_SNEAKS_AWAY,
  MEETING_WINDOW_MS,
  meetingHoldsTime,
  meetingLines,
  openMeetingUi,
  pressMeetingUi,
  stepMeetingUi,
  type MeetingUi
} from './meeting-window';
import { FIXED_FONT } from './test-font';

// The meetings of docs/re/forces-reference.md, on synthetic rosters
// with the entries at their real indices, as in the sim's tests.

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

const meeting = (entries: RosterEntry[], pending: Meeting): SimState => {
  const sim = createSim(1);
  const roster = Array.from(
    { length: 196 },
    (_, index) =>
      entries.find(candidate => candidate.index === index) ??
      entry(index, '', { position: null, state: 0 })
  );
  return startMeeting({ ...sim, roster }, pending);
};

const FARAMIR = entry(15, 'FARAMIR');
const EOMER = entry(13, 'EOMER');
const RANGERS = entry(16, 'rangers', { leader: 15 });
const charactersMeet = meeting([FARAMIR, EOMER, RANGERS], {
  a: 15,
  b: 13,
  kind: 'follow'
});
const unitsMeet = meeting(
  [
    entry(73, 'infantry', { isUnit: true, strength: 1000 }),
    entry(72, 'infantry', { isUnit: true, strength: 800 })
  ],
  { a: 73, b: 72, kind: 'follow' }
);
const advisorMeet = meeting(
  [entry(5, 'ARAGORN'), entry(3, 'ELROND', { allegiance: 3 })],
  { a: 5, b: 3, kind: 'talk' }
);
const plainMeet = meeting([FARAMIR, entry(26, 'THEODEN', { allegiance: 1 })], {
  a: 15,
  b: 26,
  kind: 'plain'
});

const window = (sim: SimState, now = 0) => {
  const ui = openMeetingUi(FIXED_FONT, sim, now);
  if (ui?.kind !== 'window') {
    throw new Error('no meeting window');
  }
  return ui;
};

const centre = (ui: MeetingUi, label: string) => {
  const found = ui.kind === 'window' && ui.buttons.find(b => b.label === label);
  if (!found) {
    throw new Error(`no ${label} button`);
  }
  return { x: found.x + 2, y: found.y + 2 };
};

describe('meeting window', () => {
  test('words each kind of meeting as the original', () => {
    expect(meetingLines(charactersMeet, charactersMeet.meeting!)).toEqual([
      'FARAMIR meets EOMER.',
      'EOMER welcomes FARAMIR to join.'
    ]);
    expect(meetingLines(unitsMeet, unitsMeet.meeting!)).toEqual([
      '1000 infantry meet 800 infantry.',
      'Infantry welcome the infantry to join.'
    ]);
    expect(meetingLines(advisorMeet, advisorMeet.meeting!)).toEqual([
      'ARAGORN meets ELROND.',
      'ELROND invites ARAGORN to pause and talk.'
    ]);
    expect(meetingLines(plainMeet, plainMeet.meeting!)).toEqual([
      'FARAMIR meets THEODEN.'
    ]);
  });

  test('offers Follow or Go there beside Continue on, at the top', () => {
    const follow = window(charactersMeet);
    expect(follow.box).toEqual({ height: 44, width: 192, x: 88, y: 5 });
    // A button's area starts a pixel above its label, which is at 30
    // in the box (finding:ui-message-box-text-colour).
    expect(follow.buttons.map(b => [b.label, b.x, b.y])).toEqual([
      ['Follow EOMER', 104, 34],
      ['Continue on', 198, 34]
    ]);
    expect(window(unitsMeet).buttons[0]!.label).toBe('Follow infantry');
    expect(window(advisorMeet).buttons.map(b => b.label)).toEqual([
      'Go there',
      'Continue on'
    ]);
    expect(window(plainMeet).buttons.map(b => b.label)).toEqual([
      'Go there',
      'Continue on'
    ]);
    for (const ui of [follow, window(unitsMeet)]) {
      for (const b of ui.buttons) {
        expect(b.x + b.width).toBeLessThanOrEqual(ui.box.x + ui.box.width);
        expect(b.y + b.height).toBeLessThanOrEqual(ui.box.y + ui.box.height);
      }
    }
  });

  test('Follow makes A follow B and sets both off again', () => {
    const ui = window(charactersMeet);
    const result = pressMeetingUi(
      ui,
      charactersMeet,
      centre(ui, 'Follow EOMER')
    );
    expect(result.choice).toBe('follow');
    expect(result.ui).toBeNull();
    expect(result.sim.meeting).toBeNull();
    expect(result.sim.roster[15]).toMatchObject({ leader: 13, state: 1 });
    expect(result.sim.roster[13]).toMatchObject({ leader: null, state: 1 });
    expect(result.sim.roster[16]!.leader).toBe(15);
  });

  test('Continue on and Go there change nothing but the states', () => {
    for (const [sim, label] of [
      [charactersMeet, 'Continue on'],
      [advisorMeet, 'Go there'],
      [plainMeet, 'Continue on']
    ] as const) {
      const ui = window(sim);
      const result = pressMeetingUi(ui, sim, centre(ui, label));
      expect(result.ui).toBeNull();
      expect(result.sim.meeting).toBeNull();
      expect(result.sim.roster[sim.meeting!.a]!.leader).toBeNull();
      expect(result.sim.roster[sim.meeting!.a]!.state).toBe(1);
    }
  });

  test('a press off the buttons leaves the window up', () => {
    const ui = window(charactersMeet);
    const result = pressMeetingUi(ui, charactersMeet, { x: 150, y: 12 });
    expect(result).toEqual({ choice: null, sim: charactersMeet, ui });
  });

  test('times out after 720 frames into Continue on', () => {
    expect(MEETING_WINDOW_MS).toBe(14_400);
    const ui = window(charactersMeet, 1000);
    const before = stepMeetingUi(ui, charactersMeet, 1000 + 14_399);
    expect(before.ui).toBe(ui);
    expect(before.sim.meeting).not.toBeNull();
    const after = stepMeetingUi(ui, charactersMeet, 1000 + 14_400);
    expect(after.ui).toBeNull();
    expect(after.sim.meeting).toBeNull();
    expect(after.sim.roster[15]).toMatchObject({ leader: null, state: 1 });
    expect(after.sim.roster[13]!.state).toBe(1);
  });

  test('the clock stands still until the window is answered', () => {
    const ui = window(charactersMeet);
    expect(meetingHoldsTime(ui)).toBe(true);
    const held = tickSim(charactersMeet);
    expect(held.clock).toEqual(charactersMeet.clock);
    const answered = stepMeetingUi(ui, charactersMeet, MEETING_WINDOW_MS);
    expect(meetingHoldsTime(answered.ui)).toBe(false);
    expect(tickSim(answered.sim).clock).not.toEqual(charactersMeet.clock);
  });

  test('an Encounter invitation holds the mover, and both choices and the default release it', () => {
    const sim = meeting(
      [
        entry(7, 'FRODO'),
        entry(153, 'TOM BOMBADIL', {
          allegiance: 3,
          figure: 82,
          position: null,
          state: 0
        })
      ],
      { a: 7, b: 153, kind: 'talk' }
    );
    expect(sim.roster[7]!.state).toBe(2);
    expect(sim.roster[153]!.state).toBe(0);
    expect(tickSim(sim)).toBe(sim);
    const ui = window(sim, 100);
    expect(ui.lines).toEqual([
      'FRODO meets TOM BOMBADIL.',
      'TOM BOMBADIL invites FRODO to pause and talk.'
    ]);
    const results = [
      pressMeetingUi(ui, sim, centre(ui, 'Go there')),
      pressMeetingUi(ui, sim, centre(ui, 'Continue on')),
      stepMeetingUi(ui, sim, 100 + MEETING_WINDOW_MS)
    ];
    for (const result of results) {
      expect(result.ui).toBeNull();
      expect(result.sim.meeting).toBeNull();
      expect(result.sim.roster[7]!.state).toBe(1);
      expect(result.sim.roster[153]).toEqual(sim.roster[153]!);
    }
  });

  test("Gollum sneaking away leaves a notice that doesn't hold time", () => {
    const sim = meeting(
      [
        entry(78, 'GOLLUM', { allegiance: 40, leader: 15 }),
        FARAMIR,
        entry(1, 'GANDALF', { figure: 4 })
      ],
      { a: 15, b: 1, kind: 'follow' }
    );
    const ui = window(sim);
    const result = pressMeetingUi(ui, sim, centre(ui, 'Follow GANDALF'));
    expect(result.ui).toEqual({ kind: 'notice', text: GOLLUM_SNEAKS_AWAY });
    expect(meetingHoldsTime(result.ui)).toBe(false);
    // The message box closes it (message-box.ts).
    expect(stepMeetingUi(result.ui!, result.sim, 1_000_000).ui).toBe(result.ui);
  });

  test('a saved meeting reopens its window on restore', () => {
    const restored = restoreSave(serialiseSave(charactersMeet), null);
    if (!restored.ok) {
      throw new Error('restore failed');
    }
    expect(window(restored.state).lines).toEqual([
      'FARAMIR meets EOMER.',
      'EOMER welcomes FARAMIR to join.'
    ]);
  });
});
