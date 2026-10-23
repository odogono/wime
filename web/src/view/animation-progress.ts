// How the Animation Level moves on, frame by frame: its pace, the
// Encounters that walk past, advisor talks, fights on the Level and the
// watched Character's figures walking off (docs/spec/animation-level.md,
// docs/spec/encounters.md, docs/spec/combat.md). The game's rules stay
// in the sim (ADR-0002); this decides when they run and what the scene
// shows meanwhile. The host is the browser loop, or a test.
import {
  answerMeeting,
  isHeld,
  releaseWatched,
  tickSim,
  type Meeting,
  type SimState
} from '../sim/index';
import {
  fightOnAnimationLevel,
  stepBattle,
  walkAfterBattle,
  type BattleStage
} from './animation-combat';
import { stepStage, walkedOff, type Stage } from './animation-level';
import {
  advanceAnimationPace,
  animationPace,
  type AnimationPace
} from './animation-pace';
import {
  partyAfterTalk,
  pressEncounterTalk,
  stepEncounterTalk,
  talkLines,
  type EncounterTalk,
  type TalkLines
} from './encounter-talk';
import type { ScriptWorld } from './figure-script';
import { WALK_PAST_MS, dropPassers, walkPast } from './walk-past';

type World = Omit<ScriptWorld, 'laggardLine'>;

// The empty roster entry 0, watched when the Animation Level shows a
// spot with nobody there.
export const NOBODY = 0;

// Script times are in the original's vertical blanks, 50 a second.
export const vblankAt = (ms: number): number => Math.floor((ms * 50) / 1000);

// Restart the figures from now once a box no longer holds them.
export const resumeStage = (stage: Stage, now: number): Stage => ({
  ...stage,
  figures: stage.figures.map(figure => ({ ...figure, next: vblankAt(now) }))
});

export interface AnimationProgress {
  battle: BattleStage | null;
  pace: AnimationPace;
  // The party's figures and any passers.
  stage: Stage;
  talk: EncounterTalk | null;
  // The clock stands while an Encounter walks past
  // (finding:forces-pass-by-walks-past-on-animation-level).
  walkPastUntil: number;
}

export const animationProgress = (): AnimationProgress => ({
  battle: null,
  pace: animationPace(),
  stage: { figures: [], party: 0 },
  talk: null,
  walkPastUntil: 0
});

// A new entry to the Level, on a scene just built: its pace starts again.
export const enterAnimationLevel = (
  progress: AnimationProgress,
  stage: Stage
): AnimationProgress => ({ ...progress, pace: animationPace(), stage });

// What the browser loop does for the Level. `sim` is read and written
// through the host, as its boxes change it too.
export interface ProgressHost {
  // After each tick, the boxes it raised; whether held figures resume.
  afterTick(now: number): boolean;
  // Whether the fight's combat window is up.
  combatShown(): boolean;
  // In Demo mode the Level neither ticks the sim nor answers talks: the
  // Demo does both, and the Level shows its state (demo-mode.ts).
  readonly demo: boolean;
  // Up to the Campaign Level.
  goUp(): void;
  // A box, window or wait holds the clock: no tick runs.
  holdsClock(): boolean;
  // A box with buttons, or a wait, holds the figures where they stand.
  holdsFigures(): boolean;
  // The figures' landed objects, and Put Down's message once down.
  land(stage: Stage): Stage;
  readonly party: readonly number[];
  // Paused, or a raised box waits for the open one: no time passes.
  paused(): boolean;
  // Build the scene again for the same watch, where it now stands, and
  // its party walking in.
  rebuild(): Stage;
  sim: SimState;
  // The fight's figures and its combat window, the watched Character
  // attacked.
  startFight(now: number): BattleStage;
  // The advisor talk for a meeting, on the party's stage.
  startTalk(
    meeting: Meeting,
    stage: Stage,
    lines: TalkLines,
    now: number,
    meets: boolean
  ): EncounterTalk;
  // A frame of the fight's Orders once the approach is over; `fought`
  // when the approach has just ended.
  stepCombat(now: number, fought: boolean): void;
  readonly watched: number;
  readonly world: World;
}

// What the frame leaves: still on the Level, gone up, or a scene built
// again, not yet drawn.
export type ProgressOutcome = 'stay' | 'up' | 'rebuilt';

// A talk rebuilds the scene with the party walking in from the left
// (code+0x0b496, code+0x0af20). Met on the Animation Level, where the
// party had walked to picks its line.
export const beginTalk = (
  progress: AnimationProgress,
  host: ProgressHost,
  meeting: Meeting,
  now: number,
  meets: boolean
): AnimationProgress => {
  const lines = talkLines(meets ? progress.stage : null);
  const stage = meets ? host.rebuild() : progress.stage;
  return {
    ...progress,
    stage,
    talk: host.startTalk(meeting, stage, lines, now, meets)
  };
};

// A press during a talk closes its box; the party walks on once it is
// over.
export const pressTalk = (progress: AnimationProgress): AnimationProgress =>
  progress.talk && !pressEncounterTalk(progress.talk)
    ? endTalk(progress, progress.talk)
    : progress;

const endTalk = (
  progress: AnimationProgress,
  ended: EncounterTalk
): AnimationProgress => ({
  ...progress,
  stage: partyAfterTalk(ended),
  talk: null
});

// Encounters the watched Character passed by since `raised` walk past
// a scene set again, the party walking in from the left
// (code+0x0b534).
const walkPastRaised = (
  progress: AnimationProgress,
  host: ProgressHost,
  raised: number,
  now: number,
  rebuilt: boolean
): AnimationProgress => {
  let next = progress;
  for (const passing of host.sim.passings.slice(raised)) {
    if (!('kind' in passing) && passing.a === host.watched) {
      const stage = rebuilt ? next.stage : host.rebuild();
      next = {
        ...next,
        stage: walkPast(
          stage,
          host.sim.roster[passing.b]!,
          host.world,
          vblankAt(now)
        ),
        walkPastUntil: now + WALK_PAST_MS
      };
    }
  }
  return next;
};

// One frame of the Level. Game time is ticked here, never again by the
// caller in the same frame, especially on Very Hasty.
export const stepAnimationLevel = (
  start: AnimationProgress,
  host: ProgressHost,
  now: number,
  elapsedMs: number
): { outcome: ProgressOutcome; progress: AnimationProgress } => {
  let progress = start;
  // Time runs at the Level's own pace, held while the watched
  // Character's figures walk (animation-pace.ts).
  const watchedEntry = host.sim.roster[host.watched];
  const paced = advanceAnimationPace(
    progress.pace,
    host.paused() ? 0 : elapsedMs,
    watchedEntry?.destination !== null &&
      watchedEntry?.destination !== undefined &&
      watchedEntry.state === 1,
    isHeld(host.sim)
  );
  progress = { ...progress, pace: paced.pace };
  // Talks, passers walking past, boxes and windows, fights and meetings
  // hold the clock.
  for (
    let i = 0;
    i < paced.ticks &&
    !host.demo &&
    !progress.talk &&
    now >= progress.walkPastUntil &&
    !host.holdsClock() &&
    !host.sim.fight &&
    !host.sim.meeting;
    i++
  ) {
    const raised = host.sim.passings.length;
    host.sim = tickSim(host.sim);
    progress = walkPastRaised(progress, host, raised, now, false);
    if (host.afterTick(now)) {
      progress = { ...progress, stage: resumeStage(progress.stage, now) };
    }
  }
  // Meetings of the watched Character with an advisor start here
  // without the Campaign Level's choice.
  const meeting = host.sim.meeting;
  if (!host.demo && meeting?.kind === 'talk' && meeting.a === host.watched) {
    host.sim = answerMeeting(host.sim, 'go-there').world;
    progress = beginTalk(progress, host, meeting, now, true);
  }
  const fight = host.sim.fight;
  if (fight && !progress.battle) {
    const watchingFight = fight.rows.some(
      row => row.side === 'good' && row.entries.includes(host.watched)
    );
    if (!watchingFight || !fightOnAnimationLevel(host.sim)) {
      host.goUp();
      return { outcome: 'up', progress: { ...progress, talk: null } };
    }
    progress = { ...progress, battle: host.startFight(now) };
  }
  progress = stepScene(progress, host, now);
  const { battle, stage, talk } = progress;
  const sim = host.sim;
  if (
    sim.meeting ||
    sim.council ||
    sim.ending ||
    (!battle &&
      !talk &&
      host.watched !== NOBODY &&
      (stage.figures.length === 0 ||
        sim.roster[host.watched]!.strength === 0 ||
        (walkedOff(stage) && !sim.roster[host.watched]!.destination)))
  ) {
    host.goUp();
    return { outcome: 'up', progress: { ...progress, talk: null } };
  }
  if (!battle && !talk && host.watched !== NOBODY && walkedOff(stage)) {
    // The figures have walked off on the way somewhere: the watched
    // Character takes its held step and the next scene is built where it
    // now stands
    // (finding:movement-watched-character-advances-as-its-figures-walk-off).
    const raised = host.sim.passings.length;
    host.sim = releaseWatched(host.sim);
    progress = { ...progress, stage: host.rebuild() };
    progress = walkPastRaised(progress, host, raised, now, true);
    return { outcome: 'rebuilt', progress };
  }
  return { outcome: 'stay', progress };
};

// The talk, the fight or the party's figures move on a frame.
const stepScene = (
  progress: AnimationProgress,
  host: ProgressHost,
  now: number
): AnimationProgress => {
  const { battle, talk } = progress;
  if (talk) {
    const stepped = stepEncounterTalk(talk, host.world, now);
    return stepped ? { ...progress, talk: stepped } : endTalk(progress, talk);
  }
  const fight = host.sim.fight;
  if (battle && fight && host.combatShown()) {
    const next = stepBattle(battle, fight, vblankAt(now));
    if (next.phase !== 'fighting') {
      return { ...progress, battle: next };
    }
    host.stepCombat(now, battle.phase === 'approach');
    if (host.sim.fight) {
      return { ...progress, battle: next };
    }
    return {
      ...progress,
      battle: null,
      stage: walkAfterBattle(next, fight, vblankAt(now))
    };
  }
  if (host.sim.fight || host.holdsFigures()) {
    return progress;
  }
  const stage = dropPassers(
    stepStage(progress.stage, host.world, vblankAt(now)),
    host.party
  );
  return { ...progress, stage: host.land(stage) };
};
