// Original Scenario design for docs/spec/shuffled-setup.md. Rows follow
// placement slot order, not object number: duplicate objects have separate
// limits. Only identifiers and original prose belong here, never extracted
// coordinates or resource text.
export interface ObjectLimit {
  object: number;
  places: readonly number[];
  reason: string;
}

export const OBJECT_LIMITS: readonly ObjectLimit[] = [
  {
    object: 1,
    places: [27, 28, 29],
    reason:
      'Keep the Dwarven Token around its Erebor recipient (finding:mobilisation-token-table); provisional regional boundary.'
  },
  {
    object: 2,
    places: [11, 12, 13, 16],
    reason: 'Keep the staff in the wooded eastern approaches to the Shire.'
  },
  {
    object: 3,
    places: [30, 31, 32, 23],
    reason:
      'Offer the ground sword along the old Elven road toward the mountains.'
  },
  {
    object: 4,
    places: [12, 13, 15, 16],
    reason:
      'Keep the first blade within a short eastern Shire expedition; provisional overlap with the other blades.'
  },
  {
    object: 4,
    places: [13, 15, 19, 20],
    reason:
      'Put the second blade among northern ruins and road stops; provisional eastern reach.'
  },
  {
    object: 4,
    places: [12, 16, 20, 23],
    reason:
      'Offer the third blade along the approach to the Council; provisional travel distance.'
  },
  {
    object: 5,
    places: [7, 27, 28, 29],
    reason:
      'Associate the hammer with Dwarven settlements and their approaches.'
  },
  {
    object: 6,
    places: [20, 22, 23, 30],
    reason:
      'Keep one suit of mail on the northern road and its Elven continuation.'
  },
  {
    object: 6,
    places: [15, 19, 21, 24],
    reason:
      'Make a second suit reward a journey into the northern border country.'
  },
  {
    object: 7,
    places: [6, 7, 8, 9],
    reason: 'Keep the seeing stone in the western coastal region.'
  },
  {
    object: 8,
    places: [23, 26, 32, 33],
    reason: 'Associate the cloak with Elven refuges and their approaches.'
  },
  {
    object: 9,
    places: [3, 5, 8, 9],
    reason: 'Keep the first healing draught accessible from the western Shire.'
  },
  {
    object: 10,
    places: [15, 18, 19, 21],
    reason: 'Place a strengthening draught along the northern frontier.'
  },
  {
    object: 11,
    places: [26, 30, 32, 33],
    reason: 'Keep one strong healing draught in the eastern Elven region.'
  },
  {
    object: 12,
    places: [38, 40, 45, 47, 57],
    reason:
      'Keep the Rohan Token on the Gondor–Rohan corridor (finding:mobilisation-token-table); provisional distance from its recipient.'
  },
  {
    object: 13,
    places: [23, 30, 31, 32, 33],
    reason:
      'Keep the rope near the mountain crossings; its use has no effect (finding:objects-rope-has-no-use).'
  },
  {
    object: 14,
    places: [1, 15, 16, 23],
    reason:
      'Retain a northern courier trip for the Gondor Token (finding:mobilisation-token-table); provisional choice rather than proximity to its recipient.'
  },
  {
    object: 15,
    places: [26, 28, 32, 33],
    reason:
      'Keep the Elven Token near its northern recipients (finding:mobilisation-token-table); provisional southern boundary.'
  },
  {
    object: 11,
    places: [35, 37, 39, 41],
    reason:
      'Offer a second strong healing draught around the western Rohan approaches; provisional availability before the war.'
  },
  {
    object: 9,
    places: [37, 38, 39, 41, 42],
    reason:
      'Offer a healing draught to a southern expedition; provisional distance from the northern opening.'
  },
  {
    object: 9,
    places: [3, 5, 8, 9, 17],
    reason: 'Keep another healing draught among the western road stops.'
  },
  {
    object: 9,
    places: [2, 4, 10, 11, 14],
    reason: 'Keep a healing draught on the opening Shire route.'
  },
  {
    object: 10,
    places: [6, 7, 8, 9, 5],
    reason: 'Reward a western detour with a strengthening draught.'
  },
  {
    object: 10,
    places: [2, 4, 10, 11, 17],
    reason: 'Keep a strengthening draught near the southern Shire approaches.'
  },
  {
    object: 6,
    places: [6, 7, 8, 9, 15],
    reason:
      'Keep the third suit of mail in the western and northern border region.'
  }
];
