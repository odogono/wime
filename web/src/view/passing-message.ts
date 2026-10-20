import { takePassing, type Passing, type SimState } from '../sim/index';
import { named } from './meeting-window';
import { messageDurationMs } from './message-timing';
import type { GameSpeed } from './tick-driver';

// docs/spec/encounters.md, "Passing by". The scouts' Campaign Level
// challenge is a notice only, as specified by the provisional rule.
// The Ring's passing after a fight shares the notice
// (docs/spec/winning-and-losing.md).
export const passingText = (sim: SimState, passing: Passing): string => {
  if ('kind' in passing) {
    if (passing.kind === 'nazgul-sent') {
      return 'The 3rd NAZGUL is sent to the site.';
    }
    const bearer = sim.roster[passing.bearer]!;
    return `${named(bearer)} now ${bearer.isUnit ? 'have' : 'has'} the RING.`;
  }
  const a = sim.roster[passing.a]!;
  const b = sim.roster[passing.b]!;
  const name = named(a);
  if (b.figure === 13 && b.strength > 1) {
    return `${name} is challenged by 20 Rohirrim scouts.`;
  }
  return `${name} ${a.isUnit ? 'pass by' : 'passes'} ${b.name}.`;
};

export interface PassingMessage {
  remaining: number;
  text: string;
  until: number;
}

// Share the box with meetings and fights, keeping queued passings in
// order and preserving the visible notice's time while it is covered.
export const stepPassingMessage = (
  message: PassingMessage | null,
  sim: SimState,
  now: number,
  free: boolean,
  speed: GameSpeed = 'normal'
): { message: PassingMessage | null; sim: SimState } => {
  if (!free) {
    return {
      message: message && { ...message, until: now + message.remaining },
      sim
    };
  }
  if (message && now < message.until) {
    return { message: { ...message, remaining: message.until - now }, sim };
  }
  const taken = takePassing(sim);
  const duration = messageDurationMs(speed);
  return {
    message: taken.passing
      ? {
          remaining: duration,
          text: passingText(sim, taken.passing),
          until: now + duration
        }
      : null,
    sim: taken.state
  };
};
