// A Unit's shield on the Atlas map (docs/spec/atlas-emblems.md): its
// Nation's device and its Unit Type's mark on a round shield, or the
// heraldic one for elite troops. The original records a Unit's Nation and
// Unit Type only in its Badge
// (finding:graphics-unit-nation-only-in-campaign-icon), so both are read
// from that, with overrides where the Badge does not fit the Unit.
import type { RosterEntry } from '../../sim/index';

export const NATIONS = [
  'beasts',
  'dale',
  'dol-amroth',
  'dunedain',
  'dunland',
  'easterlings',
  'ents',
  'erebor',
  'gondor',
  'gondor-fiefs',
  'harad',
  'iron-hills',
  'lorien',
  'mirkwood',
  'mordor',
  'outlaws',
  'rivendell',
  'rohan',
  'saruman',
  'the-dead',
  'umbar'
] as const;
export type Nation = (typeof NATIONS)[number];

export const UNIT_TYPES = [
  'cavalry',
  'dwarves',
  'elves',
  'infantry',
  'light-infantry',
  'orcs',
  'trolls'
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export interface UnitShield {
  elite: boolean;
  nation: Nation;
  // Beasts and Ents carry no weapon, so no mark.
  type: UnitType | null;
}

const shield = (
  nation: Nation,
  type: UnitType | null,
  elite = false
): UnitShield => ({ elite, nation, type });

// Each of the original's Unit Badges, by its icon: the shield's colour
// and device give the Nation, the weapon the Unit Type, and the heraldic
// shield marks elite troops.
const BADGES = new Map<number, UnitShield>([
  [0x05, shield('gondor', 'infantry', true)],
  [0x10, shield('gondor', 'infantry')],
  [0x11, shield('dol-amroth', 'cavalry', true)],
  [0x12, shield('dol-amroth', 'infantry', true)],
  [0x13, shield('gondor-fiefs', 'infantry', true)],
  [0x14, shield('gondor-fiefs', 'infantry')],
  [0x15, shield('gondor-fiefs', 'light-infantry')],
  [0x20, shield('rohan', 'cavalry')],
  [0x21, shield('rohan', 'light-infantry')],
  [0x22, shield('dale', 'infantry')],
  [0x23, shield('dale', 'light-infantry')],
  [0x24, shield('erebor', 'dwarves')],
  [0x25, shield('iron-hills', 'dwarves')],
  [0x30, shield('rivendell', 'elves')],
  [0x33, shield('saruman', 'orcs')],
  [0x34, shield('dunland', 'infantry')],
  [0x35, shield('easterlings', 'infantry')],
  [0x40, shield('easterlings', 'light-infantry')],
  [0x41, shield('harad', 'infantry')],
  [0x42, shield('harad', 'light-infantry')],
  [0x43, shield('mordor', 'trolls')],
  [0x44, shield('mordor', 'orcs')],
  [0x45, shield('umbar', 'orcs')]
]);

// Units whose Badge does not fit them, by roster index: the Elves told
// apart by the realm they start in, and the people the original had no
// shield for.
const OVERRIDES = new Map<number, Partial<UnitShield>>([
  [23, { nation: 'mirkwood' }],
  [25, { nation: 'lorien' }],
  [57, { nation: 'dunedain' }],
  [59, { nation: 'lorien' }],
  [60, { nation: 'lorien' }],
  [61, { nation: 'lorien' }],
  [62, { nation: 'mirkwood' }],
  [63, { nation: 'mirkwood' }],
  [64, { nation: 'mirkwood' }],
  [65, { nation: 'ents', type: null }],
  [66, { nation: 'ents', type: null }],
  [135, { nation: 'harad' }],
  [178, { nation: 'the-dead', type: 'infantry' }],
  [180, { nation: 'harad' }],
  [181, { nation: 'outlaws' }],
  [188, { nation: 'beasts', type: null }],
  [189, { nation: 'beasts', type: null }],
  [190, { nation: 'beasts', type: null }],
  [191, { nation: 'beasts', type: null }],
  [192, { nation: 'beasts', type: null }],
  [194, { nation: 'beasts', type: null }]
]);

export const unitShield = (unit: RosterEntry): UnitShield | null => {
  const badge = BADGES.get(unit.icon);
  const override = OVERRIDES.get(unit.index);
  if (!badge && !override?.nation) {
    return null;
  }
  return {
    elite: false,
    nation: 'mordor',
    type: null,
    ...badge,
    ...override
  };
};
