// Meetings: a moving Leader that finds a Leader that is not Evil
// (docs/spec/forces.md). The combat search finds the match
// (findMatch); a meeting stops the sweep and the clock until the
// player answers it, or the view answers "Continue on" for them when
// its window times out.

import { isEncounter } from './encounters';
import { topLeader, type RosterEntry } from './starting-state';

// Allegiance above this joins Forces; 3 is an advisor's, 1 and 2 an
// unmobilised Leader's (finding:forces-meeting-of-non-evil-leaders).
export const MOBILISED_ABOVE = 3;
export const ADVISOR = 3;

const GOLLUM = 78;
// The Animation figure byte of a Wizard
// (finding:forces-gollum-sneaks-away-from-a-wizard).
const WIZARD_FIGURE = 4;

// Frames the window waits before answering "Continue on" by itself, on
// the Campaign Level (finding:ui-meeting-window).
export const MEETING_TIMEOUT_FRAMES = 720;

// What the window offers A: to follow B, to pause and talk with B, or
// only to go there (finding:forces-meeting-of-non-evil-leaders).
export type MeetingKind = 'follow' | 'plain' | 'talk';

export interface Meeting {
  // Roster indices of the two parties.
  a: number;
  b: number;
  kind: MeetingKind;
}

// "Continue on" is the default, given when the window times out
// (finding:ui-meeting-window). "Go there", offered by the talk and plain
// windows, sets both off again as "Continue on" does: the view watches
// A on the Animation Level for the talk, which changes no game state
// (docs/spec/encounters.md).
export type MeetingAnswer = 'continue-on' | 'follow' | 'go-there';

export interface MeetingWorld {
  meeting: Meeting | null;
  roster: RosterEntry[];
}

// The meeting between a mover and the non-Evil Leader it found, or
// null when neither has allegiance above 3 and the two pass by
// (finding:forces-meeting-of-non-evil-leaders).
export const meetingBetween = (
  mover: RosterEntry,
  other: RosterEntry
): Meeting | null => {
  const moverJoins = mover.allegiance > MOBILISED_ABOVE;
  const otherJoins = other.allegiance > MOBILISED_ABOVE;
  let [a, b] = [mover, other];
  if (otherJoins && (!moverJoins || other.index > mover.index)) {
    [a, b] = [other, mover];
  }
  if (a.allegiance <= MOBILISED_ABOVE) {
    return null;
  }
  const kind: MeetingKind =
    b.allegiance > MOBILISED_ABOVE
      ? 'follow'
      : b.allegiance === ADVISOR
        ? 'talk'
        : 'plain';
  return { a: a.index, b: b.index, kind };
};

// Set the parties' states. An Encounter figure never moves, so it is
// left as it is.
const setState = (
  roster: RosterEntry[],
  meeting: Meeting,
  state: number
): RosterEntry[] =>
  roster.map(entry =>
    (entry.index === meeting.a || entry.index === meeting.b) &&
    !isEncounter(entry.index)
      ? { ...entry, state }
      : entry
  );

// Open the meeting's window. Offering to follow, or an Encounter's
// invitation to talk, stops the parties while it is up
// (finding:ui-meeting-window, finding:ui-encounter-talk-window); a
// Leader's invitation to talk or a plain meeting leaves them as they
// were.
export const startMeeting = <T extends MeetingWorld>(
  world: T,
  meeting: Meeting
): T => ({
  ...world,
  meeting,
  roster:
    meeting.kind === 'follow' || isEncounter(meeting.b)
      ? setState(world.roster, meeting, 2)
      : world.roster
});

// After any Follow, Gollum leaves a Force whose top Leader is a Wizard
// and stands where it stands
// (finding:forces-gollum-sneaks-away-from-a-wizard).
const gollumSneaksAway = (roster: RosterEntry[]): boolean => {
  const gollum = roster[GOLLUM];
  if (!gollum || gollum.leader === null) {
    return false;
  }
  const top = topLeader(roster, gollum);
  if (top.figure !== WIZARD_FIGURE) {
    return false;
  }
  roster[GOLLUM] = {
    ...gollum,
    facing: top.facing,
    leader: null,
    position: top.position && { ...top.position }
  };
  return true;
};

// Answer the meeting. Every answer sets both Leaders off again
// (state 1); Follow also makes A follow B, keeping A's own position,
// destination and route (finding:forces-follow-and-continue-on).
// gollumSneaksAway tells the view to show "GOLLUM quietly sneaks
// away.".
export const answerMeeting = <T extends MeetingWorld>(
  world: T,
  answer: MeetingAnswer
): { gollumSneaksAway: boolean; world: T } => {
  const meeting = world.meeting;
  if (!meeting) {
    return { gollumSneaksAway: false, world };
  }
  const roster = setState(world.roster, meeting, 1);
  if (answer !== 'follow' || meeting.kind !== 'follow') {
    return {
      gollumSneaksAway: false,
      world: { ...world, meeting: null, roster }
    };
  }
  roster[meeting.a] = { ...roster[meeting.a]!, leader: meeting.b };
  const sneaked = gollumSneaksAway(roster);
  return {
    gollumSneaksAway: sneaked,
    world: { ...world, meeting: null, roster }
  };
};
