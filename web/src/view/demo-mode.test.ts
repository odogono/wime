import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import {
  replayDemo,
  startDemo,
  type DemoAssets,
  type DemoPlan,
  type DemoRun,
  type DemoScript,
  type SimState
} from '../sim/index';
import { openCombatWindow, stepCombatUi } from './combat-window';
import {
  stepCouncilMessage,
  type CouncilMessageWindow
} from './council-message';
import {
  DEMO_LETTER_MS,
  DEMO_PLANS,
  demoAnswer,
  demoDisplay,
  demoLetterCloses,
  holdsDemo,
  pickDemoPlan,
  playDemo,
  stepDemoMeeting,
  tickDemo
} from './demo-mode';
import {
  NO_MESSAGES,
  closeMessage,
  stepMessages,
  type MessageContext,
  type Messages
} from './message-box';
import { FIXED_FONT } from './test-font';
import { createTickDriver } from './tick-driver';

const PUBLIC = new URL('../../public/', import.meta.url).pathname;
const STARTING_STATE = `${PUBLIC}assets/starting-state.json`;
const TILEMAP = `${PUBLIC}assets/campaign/tilemap.json`;
const PLANS: DemoPlan[] = ['fellowship', 'muster', 'defensive'];
const LEVELS = ['animation', 'campaign', 'full-map'] as const;
type Level = (typeof LEVELS)[number];

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8'));

// Called only inside the skipped block, so CI never reads the assets.
const assets = (): DemoAssets => ({
  startingState: readJson(STARTING_STATE),
  tilemap: readJson(TILEMAP) as DemoAssets['tilemap']
});

// A seeded chooser for the view's own picks, so a failure repeats.
const chooser = (seed: number) => {
  let state = seed >>> 0;
  return (n: number): number => {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
    return Math.floor(((state >>> 8) / 0x1_00_00_00) * n);
  };
};

// The view's side of Demo mode, as main.ts's frame loop plays it: a
// copy of the Demo's state shown with its boxes, fight, meeting and
// Council windows, on whichever Level, watching whichever Character.
// The Demo is held while they play out and ticks at Very Hasty.
const playThroughView = (
  script: DemoScript,
  loaded: DemoAssets,
  seed: number
): DemoRun => {
  const choose = chooser(seed);
  const driver = createTickDriver('very-hasty');
  let run = startDemo(script, loaded);
  let sim: SimState = demoDisplay(run);
  let messages: Messages = { ...NO_MESSAGES };
  let council: CouncilMessageWindow | null = null;
  let level: Level = 'animation';
  let watched = sim.ringBearer!;
  let now = 0;
  const context = (): MessageContext => ({
    choose,
    font: FIXED_FONT,
    level,
    now,
    speed: driver.speed
  });
  for (let frames = 0; !run.state.ending && frames < 5_000_000; frames++) {
    now += 20 + choose(300);
    // Now and then the player goes to another Level, or down to watch
    // another Character, which closes the open box.
    if (choose(40) === 0) {
      level = LEVELS[choose(3)]!;
      const good = sim.roster.filter(
        entry => entry.allegiance > 0 && entry.position && entry.strength > 0
      );
      watched = good[choose(good.length)]?.index ?? watched;
      ({ messages, sim } = closeMessage({ messages, sim }, context()));
    }
    // The Animation Level goes up for a meeting or the Council.
    if (level === 'animation' && (sim.meeting || sim.council)) {
      level = 'campaign';
    }
    ({ messages, sim } = stepMessages({ messages, sim }, context(), !!council));
    if (level === 'full-map') {
      continue;
    }
    // A fight the watched Character is in plays on the Animation Level.
    if (
      level === 'animation' &&
      sim.fight &&
      !messages.combat &&
      sim.fight.rows.some(
        row => row.side === 'good' && row.entries.includes(watched)
      )
    ) {
      messages.combat = openCombatWindow(sim, now);
    }
    if (messages.combat) {
      const result = stepCombatUi(messages.combat, sim, now, choose);
      sim = result.sim;
      messages.combat = result.ui;
    }
    if (messages.meeting) {
      ({ sim, ui: messages.meeting } = stepDemoMeeting(
        messages.meeting,
        sim,
        now,
        run
      ));
    }
    ({ sim, window: council } = stepCouncilMessage(
      council,
      sim,
      new Map(),
      now
    ));
    run = playDemo(run, driver.advance(20 + choose(300)), {
      held: () =>
        holdsDemo({
          battle: false,
          combat: messages.combat,
          council: council !== null,
          other: false,
          sim,
          talk: false,
          waiting: messages.waiting
        }),
      show: state => {
        sim = state;
        ({ messages, sim } = stepMessages(
          { messages, sim },
          context(),
          !!council
        ));
      }
    });
  }
  return run;
};

describe('choosing a Demo', () => {
  test('picks at even odds among the plans', () => {
    const picks = [0, 1, 2].map(n => pickDemoPlan(null, () => n));
    expect(picks).toEqual([...DEMO_PLANS]);
  });

  test('never the one that played last, the other two at even odds', () => {
    for (const last of DEMO_PLANS) {
      let offered = 0;
      const picks = [0, 1].map(n =>
        pickDemoPlan(last, count => {
          offered = count;
          return n;
        })
      );
      expect(offered).toBe(2);
      expect(picks).not.toContain(last);
      expect(new Set(picks).size).toBe(2);
    }
  });
});

describe("a Demo's letter", () => {
  test('closes by itself 15 s after it opens', () => {
    expect(DEMO_LETTER_MS).toBe(15_000);
    expect(demoLetterCloses(1000, 1000 + DEMO_LETTER_MS - 1)).toBe(false);
    expect(demoLetterCloses(1000, 1000 + DEMO_LETTER_MS)).toBe(true);
  });
});

describe.skipIf(!existsSync(STARTING_STATE) || !existsSync(TILEMAP))(
  'Demo mode',
  () => {
    for (const plan of PLANS) {
      test(`the ${plan} Demo plays through the view as it replays headless`, () => {
        const loaded = assets();
        const script = readJson(`${PUBLIC}demos/${plan}.json`) as DemoScript;
        const replayed = replayDemo(script, loaded);
        const { milestones, state } = playThroughView(script, loaded, 7);
        expect(state.ending).toBe(replayed.state.ending);
        expect(state.ending).toBe(script.ending);
        expect(state.clock.day).toBe(replayed.state.clock.day);
        expect(milestones).toEqual(replayed.milestones);
      }, 120_000);
    }

    test('a tick resolves what waits first, and the view shows a copy', () => {
      const loaded = assets();
      const script = readJson(`${PUBLIC}demos/fellowship.json`) as DemoScript;
      let run = startDemo(script, loaded);
      while (!run.state.fight && !run.state.ending) {
        run = tickDemo(run);
      }
      const shown = demoDisplay(run);
      expect(shown).toEqual(run.state);
      expect(shown.roster).not.toBe(run.state.roster);
      const held = holdsDemo({
        battle: false,
        combat: null,
        council: false,
        other: false,
        sim: shown,
        talk: false,
        waiting: false
      });
      expect(held).toBe(true);
      // The fight is resolved in no sim time, and the tick after it runs.
      const after = tickDemo(run);
      expect(
        after.state.fight === null || after.state.fight !== run.state.fight
      ).toBe(true);
      expect(demoAnswer(after, demoDisplay(after))).toBe('continue-on');
    });
  }
);
