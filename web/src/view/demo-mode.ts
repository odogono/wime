// Demo mode (#244): while a Demo plays, its DemoRun owns the sim and
// the view is read-only. The view shows a copy of the Demo's state,
// which its windows may play out on their own clock, a fight's rounds,
// a meeting's wait, the Council's message, without touching the Demo.
// The Demo is held meanwhile; once nothing is on show it resolves the
// same in zero sim time and ticks on, exactly as the headless replay
// does (web/src/sim/demo.ts). Watching stays the view's: the Demo's sim
// keeps the headless replay's, nobody watched.
import {
  sameClock,
  sameMeeting,
  stepDemo,
  type DemoPlan,
  type DemoRun,
  type MeetingAnswer,
  type SimState
} from '../sim/index';
import { combatHoldsTime, type CombatUi } from './combat-window';
import {
  pressMeetingUi,
  stepMeetingUi,
  type MeetingUi
} from './meeting-window';

// A copy of the Demo's state for the view to show and play its windows
// out on. The terrain is shared: nothing writes it.
export const demoDisplay = (run: DemoRun): SimState => {
  const { terrain, ...rest } = run.state;
  return { ...structuredClone(rest), terrain };
};

// One tick of the Demo: the steps that resolve what waits on the player
// first, which take no sim time, then the step that ticks. A tick may
// leave the clock where it was, when a fight or a meeting stops the
// sweep, so a tick is told by the step, not the clock.
export const tickDemo = (start: DemoRun): DemoRun => {
  let run = start;
  for (;;) {
    const { ending, fight, meeting } = run.state;
    const ticks = !fight && !meeting && !ending;
    run = stepDemo(run);
    if (ticks || run.state.ending) {
      return run;
    }
  }
};

// What the view has on show that holds the Demo.
export interface DemoShown {
  battle: boolean;
  combat: CombatUi | null;
  council: boolean;
  // Another window on show stops the clock, as the Game Speed window.
  other: boolean;
  sim: SimState;
  talk: boolean;
  waiting: boolean;
}

// The Demo waits while its copy shows a fight, a meeting or the
// Council, or a box waits to open, as game time does in play.
export const holdsDemo = (shown: DemoShown): boolean =>
  shown.waiting ||
  shown.other ||
  shown.battle ||
  shown.talk ||
  shown.council ||
  combatHoldsTime(shown.combat) ||
  shown.sim.fight !== null ||
  shown.sim.meeting !== null ||
  shown.sim.council !== null;

export interface DemoHost {
  held(): boolean;
  // Show a tick's state: the view's sim becomes this copy of the
  // Demo's, and the boxes it raised open.
  show(state: SimState): void;
}

// Up to `ticks` ticks of the Demo, each shown, while nothing holds it.
// Once its copy has reached the ending, the Demo takes the same last
// step.
export const playDemo = (
  start: DemoRun,
  ticks: number,
  host: DemoHost
): DemoRun => {
  let run = start;
  for (let i = 0; i < ticks && !run.state.ending && !host.held(); i++) {
    run = tickDemo(run);
    host.show(demoDisplay(run));
  }
  return run;
};

// The answer the Demo gives the meeting on show: the script's when its
// next input answers it, or Continue on.
export const demoAnswer = (run: DemoRun, sim: SimState): MeetingAnswer => {
  const input = run.script.inputs[run.next];
  return sim.meeting &&
    input?.kind === 'answer' &&
    sameClock(input.at, sim.clock) &&
    sameMeeting(input.meeting, sim.meeting)
    ? input.answer
    : 'continue-on';
};

// The meeting window, read-only: at its deadline it presses the Demo's
// answer on the copy, so it shows what the Demo chose.
export const stepDemoMeeting = (
  ui: MeetingUi,
  sim: SimState,
  now: number,
  run: DemoRun
): { sim: SimState; ui: MeetingUi | null } => {
  if (ui.kind !== 'window' || now < ui.deadline) {
    return stepMeetingUi(ui, sim, now);
  }
  const answer = demoAnswer(run, sim);
  const button = ui.buttons.find(candidate => candidate.choice === answer);
  if (!button) {
    return stepMeetingUi(ui, sim, now);
  }
  const { sim: answered, ui: next } = pressMeetingUi(ui, sim, {
    x: button.x,
    y: button.y
  });
  return { sim: answered, ui: next };
};

// The recorded Demos (web/public/demos), by their plans' names.
export const DEMO_PLANS: readonly DemoPlan[] = [
  'fellowship',
  'muster',
  'defensive'
];

// How a Demo was started: by idling at the title menu, or from its Demo
// entry (docs/spec/demo-mode.md).
export type DemoKind = 'chosen' | 'idle';

// The Demo to play: any but the one that played last in the session,
// at even odds. `choose(n)` picks 0 to n - 1.
export const pickDemoPlan = (
  last: DemoPlan | null,
  choose: (n: number) => number
): DemoPlan => {
  const plans = DEMO_PLANS.filter(plan => plan !== last);
  return plans[choose(plans.length)]!;
};

// Gandalf's letter closes by itself this long after it opens in a Demo.
export const DEMO_LETTER_MS = 15_000;
export const demoLetterCloses = (openedAt: number, now: number): boolean =>
  now - openedAt >= DEMO_LETTER_MS;

// An idle Demo's ending screen gives way to the title menu after this.
export const IDLE_DEMO_ENDING_MS = 10_000;
