import { QUARTER_HOURS_PER_HOUR } from './clock';
import type { MovementWorld } from './movement';
import { topLeader, type Point, type RosterEntry } from './starting-state';
import { DAILY_CHECK_HOUR, type WarEvents } from './war-events';

// Waking and mobilising roster entries when their trigger is met
// (docs/spec/war-events.md, "Triggers").

export interface WakeWorld extends MovementWorld {
  ringBearer: number | null;
  warEvents: WarEvents;
}

// Inclusive distances on each axis (finding:ai-trigger-distances-are-square).
export const RING_BEARER_REACH = 9;
export const GANDALF_REACH = 4;
// The two Gandalf entries the "near Gandalf" trigger looks at
// (finding:ai-second-gandalf-wakes-when-the-first-sleeps).
export const GANDALFS = [1, 2];

const highestBit = (byte: number): number => 31 - Math.clz32(byte);

// A follower's own position is not kept up to date; the original's
// followers stand at (0, 0) until they lead again.
const at = (entry: RosterEntry): Point => entry.position ?? { x: 0, y: 0 };

const within = (a: Point, b: Point, reach: number): boolean =>
  Math.abs(a.x - b.x) <= reach && Math.abs(a.y - b.y) <= reach;

// Whether the trigger byte's condition holds now
// (finding:ai-trigger-conditions, finding:ai-delayed-triggers-wait-for-hour-8).
export const triggerMet = (world: WakeWorld, entry: RosterEntry): boolean => {
  const byte = entry.triggerByte;
  if (byte === 0) {
    return false;
  }
  // Event bits 4 to 7 sit in the high nibble, above the delay.
  const live =
    byte > 0x0f
      ? (byte & world.warEvents.mask) >> 4
      : byte & world.warEvents.mask;
  if (live === 0) {
    return false;
  }
  const bit = highestBit(byte);
  if (bit === 0) {
    const bearer =
      world.ringBearer === null ? undefined : world.roster[world.ringBearer];
    return (
      bearer !== undefined &&
      within(at(entry), at(topLeader(world.roster, bearer)), RING_BEARER_REACH)
    );
  }
  if (bit === 2) {
    return GANDALFS.some(index => {
      const gandalf = world.roster[index];
      return (
        gandalf !== undefined &&
        gandalf.state !== 0 &&
        within(at(entry), at(gandalf), GANDALF_REACH)
      );
    });
  }
  if (bit < 4) {
    return true;
  }
  const delay = byte & 0x0f;
  const elapsed = (world.clock.day - (world.warEvents.days[bit] ?? 0)) & 0xff;
  return (
    elapsed >= delay &&
    Math.floor(world.clock.quarterHour / QUARTER_HOURS_PER_HOUR) ===
      DAILY_CHECK_HOUR
  );
};

// The trigger's effect (finding:ai-trigger-what-waking-changes): only a
// living entry is woken, mobilised and sent on its first Default Orders
// stop, and its trigger is consumed once.
export const trigger = (world: WakeWorld, entry: RosterEntry): RosterEntry => {
  if (entry.strength <= 0 || entry.health <= 0) {
    return entry;
  }
  const route = world.routes[entry.route] ?? [];
  const [first, ...rest] = route;
  const place =
    first === undefined
      ? undefined
      : world.places.find(candidate => candidate.index === first);
  if (first !== undefined) {
    world.routes[entry.route] = rest;
  }
  return {
    ...entry,
    allegiance: entry.allegiance === 1 ? 99 : entry.allegiance,
    destination:
      first === undefined
        ? entry.destination
        : place
          ? { ...place.position }
          : null,
    state: entry.state === 0 ? 1 : entry.state,
    trigger: { kind: 'none' },
    triggerByte: 0
  };
};

// Test one ticked entry's trigger, as the sweep reaches it and before
// it moves (finding:ai-trigger-tested-before-the-move). Mutates the
// sweep's working copy of the world.
export const wakeEntry = (world: WakeWorld, index: number): void => {
  const entry = world.roster[index];
  if (entry?.ticked && triggerMet(world, entry)) {
    world.roster[index] = trigger(world, entry);
  }
};
