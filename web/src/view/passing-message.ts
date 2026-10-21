import { takePassing, type Passing, type SimState } from '../sim/index';
import { named } from './meeting-window';

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
  text: string;
}

// Take the oldest Encounter passed by from the sim as its notice is about
// to be shown; when and for how long is the message box's
// (message-box.ts).
export const takePassingMessage = (
  sim: SimState
): { message: PassingMessage | null; sim: SimState } => {
  const taken = takePassing(sim);
  return {
    message: taken.passing ? { text: passingText(sim, taken.passing) } : null,
    sim: taken.state
  };
};
