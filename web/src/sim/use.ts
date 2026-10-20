// Using objects: the draughts, the rope, the Tokens and the Palantír
// (docs/spec/objects.md, "Use"). Each object's kind of use, and
// whether it is used up when it works, follow the object records
// (finding:objects-use-table). The sim applies the effect and says
// what happened; the view words it, and draws the advisor's tip when
// the Palantír gives one, since the tips given belong to the session,
// not the saved game (finding:ui-advisors-share-advice).

import { RING } from './objects';
import { nextRandom } from './rng';
import type { Point, RosterEntry } from './starting-state';
import type { SimState } from './state';
import { hasWarEvent, setWarEvent } from './war-events';

export const DWARVEN_RING = 1;
export const PALANTIR = 7;
export const BLUE_POTION = 9;
export const BLACK_FLASK = 10;
export const GLOWING_VIAL = 11;
export const RED_ARROW = 12;
export const ROPE = 13;
export const SCEPTRE = 14;
export const SILVER_ORB = 15;

// The usable objects and whether each is used up when it works
// (finding:objects-use-table). The Ring's record is usable, but the
// Use list never offers object 0.
const USED_UP = new Map<number, boolean>([
  [DWARVEN_RING, true],
  [PALANTIR, false],
  [BLUE_POTION, true],
  [BLACK_FLASK, true],
  [GLOWING_VIAL, true],
  [RED_ARROW, true],
  [ROPE, false],
  [SCEPTRE, false],
  [SILVER_ORB, true]
]);

// Each Token's ruler, and the BScene CSTR shown on success; the hint
// is the one after it (finding:mobilisation-token-shown-to-ruler).
export const TOKENS: Record<
  number,
  { ruler: number; successText: number; wakes: number | null }
> = {
  [DWARVEN_RING]: { ruler: 17, successText: 38, wakes: null },
  [RED_ARROW]: { ruler: 26, successText: 40, wakes: null },
  [SCEPTRE]: { ruler: 32, successText: 42, wakes: null },
  [SILVER_ORB]: { ruler: 22, successText: 44, wakes: 62 }
};

// The vision of the nine (finding:objects-palantir-vision-or-tip).
export const VISION_TEXT = 37;

const MOBILISED = 99;

// What using an object did, for the view to word.
export type UseOutcome =
  // A blue potion: "feels much better" if it healed, else "no effect".
  | { healed: boolean; use: 'blue-potion' }
  | { use: 'black-flask' }
  | { use: 'glowing-vial' }
  | { use: 'rope' }
  // A Token: the success text if it worked, else the hint.
  | { text: number; use: 'token'; worked: boolean }
  // The Palantír: the vision (VISION_TEXT), or an advisor's tip.
  | { use: 'palantir'; vision: boolean };

// The usable objects 1 to 15 the chosen Character carries, in object
// order (finding:objects-provisions-lists).
export const usableList = (state: SimState, chosen: number): number[] =>
  (state.roster[chosen]?.objects ?? [])
    .filter(object => object !== RING && USED_UP.has(object))
    .toSorted((a, b) => a - b);

const withEntry = (
  roster: RosterEntry[],
  index: number,
  change: (entry: RosterEntry) => RosterEntry
): RosterEntry[] =>
  roster.map(entry => (entry.index === index ? change(entry) : entry));

const atRuler = (
  ruler: RosterEntry | undefined,
  position: Point
): ruler is RosterEntry =>
  ruler !== undefined &&
  ruler.state !== 0 &&
  ruler.position !== null &&
  ruler.position.x === position.x &&
  ruler.position.y === position.y;

const mobilise = (entry: RosterEntry): RosterEntry => ({
  ...entry,
  allegiance: MOBILISED,
  triggerByte: 0
});

// Show a Token where the position is. It works only on its awake
// ruler, and the sceptre only while Denethor's allegiance is 1; the
// ruler is mobilised and his trigger cleared, and the silver orb also
// wakes and mobilises the elves of entry 62
// (finding:mobilisation-token-shown-to-ruler).
const showToken = (
  state: SimState,
  object: number,
  position: Point
): { outcome: UseOutcome; state: SimState } => {
  const token = TOKENS[object]!;
  const ruler = state.roster[token.ruler];
  const worked =
    atRuler(ruler, position) && (object !== SCEPTRE || ruler.allegiance === 1);
  if (!worked) {
    return {
      outcome: { text: token.successText + 1, use: 'token', worked },
      state
    };
  }
  let roster = withEntry(state.roster, token.ruler, mobilise);
  if (token.wakes !== null) {
    roster = withEntry(roster, token.wakes, entry => ({
      ...mobilise(entry),
      state: 1
    }));
  }
  return {
    outcome: { text: token.successText, use: 'token', worked },
    state: { ...state, roster }
  };
};

// Look into the Palantír: above 30 in 100, with War Event 7 not yet
// set, the vision of the nine sets it with the day, silently;
// otherwise an advisor's tip (finding:objects-palantir-vision-or-tip).
const lookIntoPalantir = (
  state: SimState
): { outcome: UseOutcome; state: SimState } => {
  const next = nextRandom(state.rng);
  const vision =
    Math.floor(next.value * 100) > 30 && !hasWarEvent(state.warEvents, 7);
  return {
    outcome: { use: 'palantir', vision },
    state: {
      ...state,
      rng: next.state,
      warEvents: vision
        ? setWarEvent(state.warEvents, 7, state.clock.day)
        : state.warEvents
    }
  };
};

const applyUse = (
  state: SimState,
  chosen: number,
  object: number,
  position: Point
): { outcome: UseOutcome; state: SimState } => {
  // The draughts (finding:objects-draughts-heal-and-strengthen) and
  // the rope (finding:objects-rope-has-no-use).
  switch (object) {
    case BLUE_POTION: {
      const healed =
        state.roster[chosen]!.health < state.roster[chosen]!.maxHealth;
      return {
        outcome: { healed, use: 'blue-potion' },
        state: {
          ...state,
          roster: withEntry(state.roster, chosen, entry => ({
            ...entry,
            health: entry.maxHealth
          }))
        }
      };
    }
    case BLACK_FLASK:
      return {
        outcome: { use: 'black-flask' },
        state: {
          ...state,
          roster: withEntry(state.roster, chosen, entry => ({
            ...entry,
            fighting: entry.fighting + 1
          }))
        }
      };
    case GLOWING_VIAL:
      return {
        outcome: { use: 'glowing-vial' },
        state: {
          ...state,
          roster: withEntry(state.roster, chosen, entry => ({
            ...entry,
            health: entry.maxHealth + 1,
            maxHealth: entry.maxHealth + 1
          }))
        }
      };
    case ROPE:
      return { outcome: { use: 'rope' }, state };
    case PALANTIR:
      return lookIntoPalantir(state);
    default:
      return showToken(state, object, position);
  }
};

// Use an object the chosen Character carries, at the position of the
// Force on screen. An object marked used up is gone once its effect
// works; a Token that fails is kept (finding:objects-use-table). An
// object that is not carried or not usable does nothing, and gives
// no outcome.
export const applyObject = (
  state: SimState,
  chosen: number,
  object: number,
  position: Point
): { outcome: UseOutcome | null; state: SimState } => {
  const entry = state.roster[chosen];
  if (!entry || !usableList(state, chosen).includes(object)) {
    return { outcome: null, state };
  }
  const used = applyUse(state, chosen, object, position);
  const failed = used.outcome.use === 'token' && !used.outcome.worked;
  if (!USED_UP.get(object) || failed) {
    return used;
  }
  return {
    outcome: used.outcome,
    state: {
      ...used.state,
      roster: withEntry(used.state.roster, chosen, carrier => ({
        ...carrier,
        objects: carrier.objects.filter(carried => carried !== object)
      }))
    }
  };
};
