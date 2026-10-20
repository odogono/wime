// Objects carried and lying on the map: Put Down, Take and the drop
// on death (docs/spec/objects.md). Each roster entry carries a set of
// object numbers, at most one of each
// (finding:objects-carried-as-a-bitmask); objects on the ground fill
// the 30 placement slots (finding:objects-starting-placements). The
// lists and actions here take the chosen Character and the position
// of the Force on screen, as the provisions lists do
// (finding:objects-provisions-lists). Using objects is in use.ts.

import {
  OBJECT_PLACEMENT_COUNT,
  type ObjectPlacement,
  type Point
} from './starting-state';
import type { SimState } from './state';

export { OBJECT_PLACEMENT_COUNT, type ObjectPlacement };

// Object 0 is the Ring (finding:objects-carried-as-a-bitmask).
export const RING = 0;

// Take lists at most seven objects (finding:objects-provisions-lists).
export const TAKE_LIST_LIMIT = 7;

const at = (
  slot: ObjectPlacement | null,
  position: Point
): slot is ObjectPlacement =>
  slot !== null &&
  slot.position.x === position.x &&
  slot.position.y === position.y;

// The objects the chosen Character may put down, in object order: all
// it carries but the Ring, which is never listed
// (finding:objects-provisions-lists).
export const putDownList = (state: SimState, chosen: number): number[] =>
  (state.roster[chosen]?.objects ?? [])
    .filter(object => object !== RING)
    .toSorted((a, b) => a - b);

// The objects lying exactly at the position, in slot order, at most
// seven (finding:objects-provisions-lists).
export const takeList = (state: SimState, position: Point): number[] => {
  const list: number[] = [];
  for (const slot of state.objectPlacements) {
    if (at(slot, position)) {
      list.push(slot.object);
      if (list.length === TAKE_LIST_LIMIT) {
        break;
      }
    }
  }
  return list;
};

// Leave objects lying at a position, each in the first free slot; one
// that finds no free slot is lost
// (finding:objects-put-down-fills-a-free-slot).
export const dropObjects = (
  placements: (ObjectPlacement | null)[],
  objects: number[],
  position: Point
): (ObjectPlacement | null)[] => {
  const next = [...placements];
  for (const object of objects) {
    const free = next.indexOf(null);
    if (free !== -1) {
      next[free] = { object, position: { ...position } };
    }
  }
  return next;
};

// Put an object down: into the first free slot at the position, and
// no longer carried. The Ring cannot be put down, and an object the
// Character does not carry cannot either; both leave the state as it
// is (finding:objects-put-down-fills-a-free-slot).
export const putDownObject = (
  state: SimState,
  chosen: number,
  object: number,
  position: Point
): SimState => {
  const entry = state.roster[chosen];
  if (!entry || object === RING || !entry.objects.includes(object)) {
    return state;
  }
  return {
    ...state,
    objectPlacements: dropObjects(state.objectPlacements, [object], position),
    roster: state.roster.map(candidate =>
      candidate.index === chosen
        ? {
            ...candidate,
            objects: candidate.objects.filter(carried => carried !== object)
          }
        : candidate
    )
  };
};

// Take an object lying at the position: the first slot holding it
// there is freed and the chosen Character carries it. Taking an
// object already carried loses the one on the ground, and taking the
// Ring makes the taker the Ring-bearer
// (finding:objects-take-from-the-ground). With no such slot nothing
// happens.
export const takeObject = (
  state: SimState,
  chosen: number,
  object: number,
  position: Point
): SimState => {
  const entry = state.roster[chosen];
  const slot = state.objectPlacements.findIndex(
    candidate => at(candidate, position) && candidate?.object === object
  );
  if (!entry || slot === -1) {
    return state;
  }
  return {
    ...state,
    objectPlacements: state.objectPlacements.map((candidate, i) =>
      i === slot ? null : candidate
    ),
    ringBearer: object === RING ? chosen : state.ringBearer,
    roster: state.roster.map(candidate =>
      candidate.index === chosen && !candidate.objects.includes(object)
        ? {
            ...candidate,
            objects: [...candidate.objects, object].toSorted((a, b) => a - b)
          }
        : candidate
    )
  };
};
