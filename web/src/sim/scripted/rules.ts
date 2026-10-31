// Which rules the sim runs on: the TypeScript sim, or the shipped game's
// Scenario Scripts (#194, spike only). WIME_SIM_RULES=scripted switches
// them on for a whole test run.
export type SimRules = 'scripted' | 'typescript';

let simRules: SimRules =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.WIME_SIM_RULES === 'scripted'
    ? 'scripted'
    : 'typescript';

export const setSimRules = (rules: SimRules): void => {
  simRules = rules;
};

export const getSimRules = (): SimRules => simRules;
