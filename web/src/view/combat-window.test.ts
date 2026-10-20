import { describe, expect, test } from 'bun:test';

import {
  createSim,
  findFight,
  setCombatOption,
  startFight,
  type SimState
} from '../sim/index';
import {
  fightOnAnimationLevel,
  spawnBattle,
  stepBattle,
  walkAfterBattle
} from './animation-combat';
import {
  ANIMATION_ROUND_MS,
  ANNOUNCEMENT_BUTTONS,
  ANNOUNCEMENT_MS,
  EVIL_WON,
  GOOD_WON,
  ORDERS_MS,
  announcementText,
  casualtyMessage,
  combatHoldsTime,
  layoutCombatWindow,
  openCombatWindow,
  optionAt,
  pressCombatUi,
  rowLabel,
  startCombatUi,
  stepCombatUi,
  type CombatUi
} from './combat-window';
import type { ScriptWorld } from './figure-script';

// The fights of docs/re/combat-reference.md, on synthetic rosters with
// the entries at their real indices, as in the sim's combat tests.

const entry = (over: Record<string, unknown>): Record<string, unknown> => ({
  allegiance: 99,
  destination: null,
  encounter: null,
  facing: 0,
  fighting: 2,
  figure: 0,
  health: 1,
  icon: 0,
  index: 0,
  is_unit: true,
  leader: null,
  max_health: 1,
  max_stamina: 40,
  name: '',
  objects: [],
  position: null,
  route: 0,
  speed: 2,
  stamina: 40,
  starting_strength: 0,
  state: 0,
  strength: 0,
  ticked: true,
  trigger: { kind: 'none' },
  trigger_byte: 0,
  unknown: { b19: 0, b24: 0, b29: 0 },
  ...over
});

const CALEMBEL = { x: 1296, y: 1168 };
const EAST_EMNET = { x: 1360, y: 992 };
const EVIL = { allegiance: 0 };

const unit = (
  index: number,
  name: string,
  strength: number,
  over: Record<string, unknown> = {}
): Record<string, unknown> => ({
  index,
  name,
  starting_strength: strength,
  state: 1,
  strength,
  ...over
});

const character = (
  index: number,
  name: string,
  over: Record<string, unknown> = {}
): Record<string, unknown> => ({
  fighting: 10,
  health: 5,
  index,
  is_unit: false,
  max_health: 5,
  name,
  starting_strength: 1,
  state: 1,
  strength: 1,
  ...over
});

const fight = (
  entries: Record<string, unknown>[],
  mover: number,
  seed = 1
): SimState => {
  const roster = Array.from({ length: 152 }, (_, index) =>
    entry({ index, ticked: index > 0 })
  );
  for (const over of entries) {
    roster[over.index as number] = entry(over);
  }
  const sim = createSim(seed, {
    clock: { day: 0, quarter_hour: 64 },
    events: { ring_bearer: 7 },
    place_kinds: [],
    places: [
      {
        announces_attacks: true,
        grid_byte: 1,
        grid_reference: null,
        index: 1,
        name: 'CALEMBEL',
        position: CALEMBEL,
        tile: { x: 81, y: 73 },
        tile_kind: null
      }
    ],
    roster
  });
  const found = findFight(sim, mover);
  if (!found) {
    throw new Error('no fight');
  }
  return startFight(sim, found);
};

const calembel = (): SimState =>
  fight(
    [
      unit(73, 'infantry', 1000, { position: CALEMBEL }),
      unit(141, 'orcs', 500, { ...EVIL, position: CALEMBEL })
    ],
    73
  );

const faramir = (seed = 1): SimState =>
  fight(
    [
      character(15, 'FARAMIR', { position: EAST_EMNET }),
      unit(16, 'Rangers', 200, { allegiance: 1, fighting: 4, leader: 15 }),
      unit(142, 'orcs', 444, { ...EVIL, position: EAST_EMNET })
    ],
    15,
    seed
  );

const eomer = (): SimState =>
  fight(
    [
      character(13, 'EOMER', { position: EAST_EMNET }),
      unit(142, 'orcs', 5000, { ...EVIL, position: EAST_EMNET })
    ],
    13
  );

const first = (): number => 0;

const centre = (button: {
  height: number;
  width: number;
  x: number;
  y: number;
}) => ({
  x: button.x + Math.floor(button.width / 2),
  y: button.y + Math.floor(button.height / 2)
});

const goThere = ANNOUNCEMENT_BUTTONS.find(b => b.choice === 'go-there')!;
const ignoreIt = ANNOUNCEMENT_BUTTONS.find(b => b.choice === 'ignore-it')!;

// Step the window until it closes, collecting every message shown.
const runWindow = (
  sim: SimState,
  ui: CombatUi
): { messages: string[]; sim: SimState } => {
  const messages: string[] = [];
  let now = 0;
  let current: CombatUi | null = ui;
  let state = sim;
  while (current && now < 3_600_000) {
    if (current.kind === 'window' && messages.at(-1) !== current.message) {
      messages.push(current.message);
    }
    now += 20;
    const next = stepCombatUi(current, state, now, first);
    state = next.sim;
    current = next.ui;
  }
  return { messages, sim: state };
};

describe('the announcement', () => {
  test('names the Place that announces attacks, or the Leader attacked', () => {
    const sim = calembel();
    expect(announcementText(sim, sim.fight!)).toBe(
      'CALEMBEL is being attacked by 500 orcs.'
    );
    const elsewhere = faramir();
    expect(announcementText(elsewhere, elsewhere.fight!)).toBe(
      'FARAMIR is attacked by 444 orcs.'
    );
  });

  test('a Unit Leader is named with its head count', () => {
    const sim = fight(
      [
        unit(73, 'infantry', 1000, { position: EAST_EMNET }),
        unit(141, 'orcs', 500, { ...EVIL, position: EAST_EMNET })
      ],
      73
    );
    expect(announcementText(sim, sim.fight!)).toBe(
      '1000 infantry are attacked by 500 orcs.'
    );
  });

  test('unanswered, it presses "Ignore it" after 14.4 seconds, and holds time until then', () => {
    const sim = calembel();
    const ui = startCombatUi(sim, 1000)!;
    expect(combatHoldsTime(ui)).toBe(true);
    expect(stepCombatUi(ui, sim, 1000 + ANNOUNCEMENT_MS - 1, first).ui).toBe(
      ui
    );
    const after = stepCombatUi(ui, sim, 1000 + ANNOUNCEMENT_MS, first);
    expect(after.sim.fight).toBeNull();
    expect(after.ui).toMatchObject({ boxes: [GOOD_WON], kind: 'boxes' });
    // The last box stays up while time runs again.
    expect(combatHoldsTime(after.ui)).toBe(false);
  });

  test('"Ignore it" settles the fight at once and reports the dead', () => {
    const sim = eomer();
    const ui = startCombatUi(sim, 0)!;
    const after = pressCombatUi(ui, sim, centre(ignoreIt), 0);
    expect(after.sim.fight).toBeNull();
    expect(after.ui).toMatchObject({
      boxes: [EVIL_WON, 'EOMER has died in combat.'],
      kind: 'boxes'
    });
    expect(combatHoldsTime(after.ui)).toBe(true);
  });

  test('a press elsewhere does nothing', () => {
    const sim = calembel();
    const ui = startCombatUi(sim, 0)!;
    expect(pressCombatUi(ui, sim, { x: 300, y: 150 }, 0)).toEqual({ sim, ui });
  });
});

describe('the combat window', () => {
  test('lists the rows as the capture shows them', () => {
    const sim = faramir();
    const rows = sim.fight!.rows;
    expect(
      rows.map(row => rowLabel(sim.roster[row.entries[0]!]!.name, row.strength))
    ).toEqual(['FARAMIR', '200 Rangers', '444 orcs']);
    expect(rows[1]!.follower).toBe(true);
    expect(layoutCombatWindow(sim.fight!)).toEqual({
      height: 2 * 9 + 32,
      lineHeight: 9,
      messageY: 2 * 9 + 18,
      rows: 2
    });
  });

  test('"Go there" opens it with the opening message and a pause for orders', () => {
    const sim = faramir();
    const ui = startCombatUi(sim, 0)!;
    const opened = pressCombatUi(ui, sim, centre(goThere), 100);
    expect(opened.ui).toMatchObject({
      kind: 'window',
      message: 'FARAMIR and orcs move grimly into battle.',
      until: 100 + ORDERS_MS
    });
    expect(stepCombatUi(opened.ui!, sim, 100 + ORDERS_MS - 1, first).sim).toBe(
      sim
    );
  });

  test('the fight runs to its result and closes, with loss messages on the way', () => {
    const sim = faramir(2);
    const ui = pressCombatUi(
      startCombatUi(sim, 0)!,
      sim,
      centre(goThere),
      0
    ).ui!;
    const { messages, sim: after } = runWindow(sim, ui);
    expect(after.fight).toBeNull();
    expect(messages[0]).toBe('FARAMIR and orcs move grimly into battle.');
    expect([GOOD_WON, EVIL_WON]).toContain(messages.at(-1)!);
    expect(messages.length).toBeGreaterThan(2);
  });

  test("a click on an option button sets that row's option", () => {
    const sim = faramir();
    const ui = pressCombatUi(
      startCombatUi(sim, 0)!,
      sim,
      centre(goThere),
      0
    ).ui!;
    // Charge for the Rangers, the second Good row.
    const point = { x: 8 + 18 + 5, y: 16 + 9 + 3 };
    expect(optionAt(sim.fight!, point)).toEqual({ option: 'charge', row: 1 });
    // The window asks for x 6 and is drawn at 8, its buttons with it.
    expect(optionAt(sim.fight!, { ...point, x: 8 + 18 })).not.toBeNull();
    expect(optionAt(sim.fight!, { ...point, x: 8 + 17 })).toBeNull();
    const after = pressCombatUi(ui, sim, point, 10);
    expect(after.sim.fight!.rows[1]!.option).toBe('charge');
  });
});

describe('loss messages', () => {
  const unitRow = {
    entries: [16],
    follower: true,
    option: 'engage' as const,
    side: 'good' as const,
    startStrength: 200,
    strength: 173
  };
  const characterRow = {
    entries: [15],
    follower: false,
    option: 'gone' as const,
    side: 'good' as const,
    startStrength: 1,
    strength: 0
  };

  test("a Unit's losses use one of three wordings, by head count", () => {
    const event = { blow: 'share' as const, killed: 27, row: 1, wounded: 0 };
    expect(casualtyMessage(unitRow, event, 'Rangers', () => 2)).toBe(
      'The blood of 27 of the Rangers flows red on the stones.'
    );
    expect(
      casualtyMessage(
        { ...unitRow, side: 'evil' },
        { ...event, killed: 66 },
        'orcs',
        () => 0
      )
    ).toBe('66 of the orcs have been cut down!');
    expect(
      casualtyMessage({ ...unitRow, strength: 0 }, event, 'Rangers', () => 1)
    ).toBe('all of the Rangers have been slain in a frenzied assault!');
  });

  test("a Unit's losses from left-over blows are not reported", () => {
    expect(
      casualtyMessage(
        unitRow,
        { blow: 'leftover', killed: 5, row: 1, wounded: 0 },
        'Rangers',
        first
      )
    ).toBeNull();
  });

  test("a Character's fall or wound is worded by side and blow", () => {
    const killed = { blow: 'leftover' as const, killed: 1, row: 0, wounded: 0 };
    expect(casualtyMessage(characterRow, killed, 'FARAMIR', first)).toBe(
      'FARAMIR is struck down by a frenzied attack!'
    );
    expect(
      casualtyMessage(
        { ...characterRow, side: 'evil' },
        { ...killed, blow: 'share' },
        'GOTHMOG',
        first
      )
    ).toBe('GOTHMOG is felled by a mighty attack!');
    expect(
      casualtyMessage(
        { ...characterRow, strength: 1 },
        { blow: 'share', killed: 0, row: 0, wounded: 2 },
        'FARAMIR',
        first
      )
    ).toBe('FARAMIR is struck a grave wound!');
  });
});

// A small looping walking script keeps presentation tests independent
// of the extracted, gitignored assets.
const battleWorld: Omit<ScriptWorld, 'laggardLine'> = {
  frames: () => [{ height: 20, hot_x: 0, hot_y: 20, width: 12 }],
  line1: 1000,
  line2: 1000,
  random: n => n - 1,
  script: () => [0, 0, 0x42, 0, 0xa0, 2]
};

const characterFight = (seed = 1): SimState =>
  fight(
    [
      character(7, 'FRODO', { position: EAST_EMNET }),
      character(8, 'SAM', { leader: 7 }),
      character(10, 'PIPPIN', { leader: 7 }),
      unit(142, 'orcs', 30, { ...EVIL, position: EAST_EMNET })
    ],
    7,
    seed
  );

describe('fights on the Animation Level', () => {
  test('routes by every member of the Good side, including followers', () => {
    expect(fightOnAnimationLevel(eomer())).toBe(true);
    expect(fightOnAnimationLevel(characterFight())).toBe(true);
    expect(fightOnAnimationLevel(faramir())).toBe(false);
    expect(fightOnAnimationLevel(calembel())).toBe(false);
    expect(fightOnAnimationLevel(createSim(1))).toBe(false);
  });

  test('places both sides and walks to the two battle lines before fighting', () => {
    const sim = characterFight();
    const initial = spawnBattle(sim, battleWorld, first, 100);
    const good = initial.stage.figures.filter(
      (_, i) => sim.fight!.rows[initial.rows[i]!]!.side === 'good'
    );
    const rightmost = Math.max(...good.map(figure => figure.x));
    expect(initial.world.line1).toBe(rightmost + 25);
    expect(initial.world.line2).toBe(rightmost + 85);
    expect(initial.phase).toBe('approach');
    const atLines = stepBattle(initial, sim.fight!, 10_000);
    expect(atLines.phase).toBe('fighting');
    expect(atLines.stage.figures.map(figure => figure.x)).toEqual(
      atLines.homes
    );
    expect(atLines.stage.figures.at(-1)!.flipped).toBe(true);
    const balrog = spawnBattle(
      { ...sim, fight: { ...sim.fight!, evil: 183 } },
      battleWorld,
      first,
      100
    );
    expect(balrog.world.line2).toBe(rightmost + 100);
  });

  test('falls scale with row losses and only living Good figures walk on', () => {
    const sim = characterFight();
    const initial = spawnBattle(sim, battleWorld, first, 0);
    const atLines = stepBattle(initial, sim.fight!, 1000);
    const rows = sim.fight!.rows.map(row => ({
      ...row,
      strength: row.side === 'evil' ? 15 : row.entries[0] === 8 ? 0 : 1
    }));
    const after = stepBattle(atLines, { ...sim.fight!, round: 1, rows }, 1050);
    expect(after.fallen.filter(Boolean)).toHaveLength(6); // 5 of 10 orcs and Sam
    const walking = walkAfterBattle(after, { ...sim.fight!, rows }, 1060);
    expect(walking.figures.map(figure => figure.owner)).toEqual([7, 10]);
    expect(
      walking.figures.every(figure => !figure.flipped && figure.next === 1060)
    ).toBe(true);
    expect(sim.fight!.round).toBe(0);
  });

  test('charges move further forward than engaging and leave the sim untouched', () => {
    const sim = characterFight();
    const initial = spawnBattle(sim, battleWorld, first, 0);
    const ready = stepBattle(initial, sim.fight!, 1000);
    const engaged = { ...sim.fight!, round: 1 };
    const charging = {
      ...engaged,
      rows: engaged.rows.map(row => ({ ...row, option: 'charge' as const }))
    };
    const a = stepBattle(ready, engaged, 1010);
    const b = stepBattle(ready, charging, 1010);
    expect(b.stage.figures[0]!.x).toBeGreaterThan(a.stage.figures[0]!.x);
    expect(sim.fight!.round).toBe(0);
  });

  test('matches the combat window for the same seeds and orders, regardless of visual randomness', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const start = characterFight(seed);
      // Exercise the same player orders in both presentations.
      const ordered = setCombatOption(
        setCombatOption(start, 0, 'charge'),
        1,
        'withdraw'
      );
      const expected = runWindow(ordered, openCombatWindow(ordered, 0)).sim;
      let actual = ordered;
      let ui: CombatUi | null = openCombatWindow(ordered, 0);
      let battle = spawnBattle(actual, battleWorld, n => seed % n, 0);
      battle = stepBattle(battle, actual.fight!, 1000);
      for (let now = 0; ui && now < 3_600_000; now += 20) {
        const result = stepCombatUi(
          ui,
          actual,
          now,
          n => seed % n,
          ANIMATION_ROUND_MS
        );
        actual = result.sim;
        ui = result.ui;
        if (actual.fight) {
          battle = stepBattle(battle, actual.fight, 1000 + now / 20);
        }
      }
      expect(actual.fight).toBeNull();
      expect(actual).toEqual(expected);
    }
  });
});
