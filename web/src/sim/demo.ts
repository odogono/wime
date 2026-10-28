// The Demo driver (#244): plays a campaign one sim step at a time from
// a Player, the same way for the headless strategy player
// (tools/strategy.ts) and the browser's Demo mode. A Demo is a
// recorded script of player inputs that replays from its seed to its
// ending. Each step drains the announcements and passings, closes the
// Council, resolves a fight, answers a meeting, or, once per
// quarter-hour, applies the Player's Orders and object acts and ticks
// the sim.
import { type Clock } from './clock';
import { LAST_GOOD_ENTRY, resolveFight } from './combat';
import { closeCouncil } from './council';
import { type Ending } from './endings';
import { answerMeeting, type Meeting, type MeetingAnswer } from './meetings';
import { giveOrder, takesOrder } from './movement';
import { putDownObject, takeObject } from './objects';
import { topLeader, type Point } from './starting-state';
import {
  createSim,
  takeAnnouncement,
  takePassing,
  tickSim,
  type SimState
} from './state';
import type { TerrainGrid } from './terrain';
import { applyObject } from './use';
import { INITIAL_WAR_EVENTS } from './war-events';

export const DEMO_VERSION = 1;

export type DemoPlan = 'defensive' | 'fellowship' | 'muster';

// Take, Put Down or Use, by the chosen Character at its Force's
// position, as the provisions lists do (finding:objects-provisions-lists).
export interface ObjectCommand {
  act: 'put-down' | 'take' | 'use';
  member: number;
  object: number;
}

export type Command = ObjectCommand | { member: number; to: Point };

// One player input, applied at a clock time. Orders are applied at the
// first decision point of their quarter-hour, in the listed order, each
// through the allegiance roll. A meeting answer is matched to the
// meeting it answers; meetings not listed are answered "Continue on",
// as the window does when it times out.
export type DemoInput =
  | { at: Clock; kind: 'order'; member: number; to: Point }
  | ({ at: Clock; kind: 'object' } & ObjectCommand)
  | { answer: MeetingAnswer; at: Clock; kind: 'answer'; meeting: Meeting };

export interface Milestones {
  // The day the Council was held, before it moved the calendar on.
  council: number | null;
  // The first Leader the War Events or a trigger put under the
  // player's command, and the day.
  mobilisation: { day: number; leader: string } | null;
  // War Events 3 to 7, in the order they were set, with their days.
  warEvents: { day: number; event: number }[];
}

export interface DemoScript {
  ending: Ending | null;
  finalDay: number;
  inputs: DemoInput[];
  milestones: Milestones;
  plan: DemoPlan;
  seed: number;
  version: number;
}

export interface DemoAssets {
  startingState: unknown;
  terrain: TerrainGrid;
}

// What plays the campaign: answers meetings, and once per quarter-hour,
// when nothing waits on the player, gives its Commands.
export interface Player {
  answer: (state: SimState, meeting: Meeting) => MeetingAnswer;
  decide: (state: SimState) => Command[];
}

export interface CampaignRun {
  // The quarter-hour the Player last decided at.
  decided: Clock | null;
  // Object acts that had no effect. Orders refused by the allegiance
  // roll are ordinary play, and are not failed object acts.
  failedActs: number;
  milestones: Milestones;
  // The Good entries under the player's command so far.
  mobilised: readonly number[];
  state: SimState;
}

export interface DemoRun extends CampaignRun {
  // The index in script.inputs of the next input to apply.
  next: number;
  script: DemoScript;
}

export interface CampaignResult {
  inputs: DemoInput[];
  milestones: Milestones;
  state: SimState;
}

export const sameClock = (a: Clock, b: Clock): boolean =>
  a.day === b.day && a.quarterHour === b.quarterHour;

export const sameMeeting = (a: Meeting, b: Meeting): boolean =>
  a.a === b.a && a.b === b.b && a.kind === b.kind;

export const startCampaign = (
  seed: number,
  assets: DemoAssets
): CampaignRun => {
  const state = createSim(seed, assets.startingState, assets.terrain);
  return {
    decided: null,
    failedActs: 0,
    milestones: { council: null, mobilisation: null, warEvents: [] },
    mobilised: state.roster.filter(e => e.allegiance > 1).map(e => e.index),
    state
  };
};

// Over once it reaches an ending or the start of dayCap.
export const campaignOver = (run: CampaignRun, dayCap: number): boolean =>
  run.state.ending !== null || run.state.clock.day >= dayCap;

// One step: whatever waits on the player, or the quarter-hour's
// Commands, then a tick. A step that answers a fight or a meeting, or
// finds an ending, does not tick.
export const stepCampaign = (run: CampaignRun, player: Player): CampaignRun => {
  let state = run.state;
  while (state.announcements.length > 0) {
    state = takeAnnouncement(state).state;
  }
  while (state.passings.length > 0) {
    state = takePassing(state).state;
  }
  if (state.council) {
    state = closeCouncil(state);
  }
  if (state.fight) {
    return { ...run, state: resolveFight(state) };
  }
  if (state.meeting) {
    const answer = player.answer(state, state.meeting);
    return { ...run, state: answerMeeting(state, answer).world };
  }
  if (state.ending) {
    return { ...run, state };
  }
  let { decided, failedActs, milestones, mobilised } = run;
  if (!decided || !sameClock(decided, state.clock)) {
    ({ milestones, mobilised } = noteMilestones(
      state,
      milestones,
      mobilised,
      decided?.day ?? 0
    ));
    decided = { ...state.clock };
    for (const command of player.decide(state)) {
      if ('act' in command) {
        const acted = actOnObject(state, command);
        if (acted === state) {
          failedActs++;
        }
        state = acted;
        continue;
      }
      const { taken, world } = takesOrder(state, command.member);
      state = taken ? giveOrder(world, command.member, command.to) : world;
    }
  }
  return { decided, failedActs, milestones, mobilised, state: tickSim(state) };
};

// Take, Put Down or Use, at the position of the chosen Character's
// Force (finding:objects-provisions-lists).
const actOnObject = (state: SimState, command: ObjectCommand): SimState => {
  const position = topLeader(
    state.roster,
    state.roster[command.member]!
  ).position!;
  const { act, member, object } = command;
  return act === 'take'
    ? takeObject(state, member, object, position)
    : act === 'put-down'
      ? putDownObject(state, member, object, position)
      : applyObject(state, member, object, position).state;
};

const noteMilestones = (
  state: SimState,
  before: Milestones,
  mobilisedBefore: readonly number[],
  dayBefore: number
): { milestones: Milestones; mobilised: readonly number[] } => {
  const milestones = { ...before, warEvents: [...before.warEvents] };
  const mobilised = [...mobilisedBefore];
  // The Council moves the calendar on (docs/spec/council-of-elrond.md),
  // so it is dated by the last decision point before it.
  if (milestones.council === null && !state.councilPending) {
    milestones.council = dayBefore;
  }
  // Event 1, Gandalf's death, keeps no day (docs/spec/war-events.md).
  for (let event = 3; event < 8; event++) {
    if (
      state.warEvents.mask & (1 << event) &&
      !(INITIAL_WAR_EVENTS.mask & (1 << event)) &&
      !milestones.warEvents.some(noted => noted.event === event)
    ) {
      milestones.warEvents.push({
        day: state.warEvents.days[event]!,
        event
      });
    }
  }
  for (const entry of state.roster.slice(1, LAST_GOOD_ENTRY + 1)) {
    if (entry.allegiance > 1 && !mobilised.includes(entry.index)) {
      mobilised.push(entry.index);
      milestones.mobilisation ??= { day: state.clock.day, leader: entry.name };
    }
  }
  return { milestones, mobilised };
};

// Include changes on the final step, even when an ending or the day cap
// prevents the next decision point from recording them.
export const campaignMilestones = (run: CampaignRun): Milestones =>
  noteMilestones(
    run.state,
    run.milestones,
    run.mobilised,
    run.decided?.day ?? run.state.clock.day
  ).milestones;

// --- Demos ----------------------------------------------------------------

export const startDemo = (script: DemoScript, assets: DemoAssets): DemoRun => ({
  ...startCampaign(script.seed, assets),
  next: 0,
  script
});

// One step of the Demo, its Player reading the script's inputs.
export const stepDemo = (run: DemoRun): DemoRun => {
  const { inputs } = run.script;
  let next = run.next;
  const player: Player = {
    answer: (state, meeting) => {
      const input = inputs[next];
      if (
        input?.kind === 'answer' &&
        sameClock(input.at, state.clock) &&
        sameMeeting(input.meeting, meeting)
      ) {
        next++;
        return input.answer;
      }
      return 'continue-on';
    },
    decide: state => {
      const commands: Command[] = [];
      for (
        let input = inputs[next];
        (input?.kind === 'order' || input?.kind === 'object') &&
        sameClock(input.at, state.clock);
        input = inputs[++next]
      ) {
        const { at: _at, kind: _kind, ...command } = input;
        commands.push(command);
      }
      return commands;
    }
  };
  const stepped = stepCampaign(run, player);
  return { ...stepped, next, script: run.script };
};

const MAX_STEPS = 20_000_000;

// Steps a run until it is over, by an ending or the day cap.
export const runToEnd = <Run extends CampaignRun>(
  run: Run,
  step: (run: Run) => Run,
  dayCap: number
): Run => {
  let steps = 0;
  while (!campaignOver(run, dayCap)) {
    if (++steps > MAX_STEPS) {
      throw new Error('the campaign stopped moving');
    }
    run = step(run);
  }
  return run;
};

// Replays a Demo whole, to its ending or the day cap.
export const replayDemo = (
  script: DemoScript,
  assets: DemoAssets,
  dayCap = 400
): CampaignResult => {
  const { milestones, state } = runToEnd(
    startDemo(script, assets),
    stepDemo,
    dayCap
  );
  return { inputs: script.inputs, milestones, state };
};

export const isGoodVictory = (ending: Ending | null): boolean =>
  ending === 'won-mount-doom' || ending === 'won-barad-dur';
