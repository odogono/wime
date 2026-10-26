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

// A candidate is the inclusive rectangle between two named Places' tiles.
// Repeating a Place selects just that tile. These are regional habitat
// choices, not a terrain filter or copies of the original rectangles.
export interface EncounterLimit {
  areas: readonly (readonly [number, number])[];
  firstDay: readonly [number, number];
  reason: string;
  roster: number;
}

export const ENCOUNTER_EXCLUSION_ZONES = [
  {
    marginTiles: 2,
    place: 2,
    reason:
      'Keep Hobbiton and two rings of neighbouring tiles clear, so the Ring-bearer can leave the opening tile and take a first step beyond its immediate neighbours without an Encounter.'
  }
] as const;

// All area boundaries and day ranges are provisional Scenario design.
// The rows retain each figure's regional identity; chance is never a limit
// because it controls difficulty (docs/spec/shuffled-setup.md).
export const ENCOUNTER_LIMITS: readonly EncounterLimit[] = [
  {
    areas: [
      [9, 9],
      [6, 6]
    ],
    firstDay: [0, 10],
    reason:
      'Keep Círdan at the western Elven ports; Forlond is a provisional alternative to the Grey Havens.',
    roster: 152
  },
  {
    areas: [[12, 12]],
    firstDay: [0, 10],
    reason:
      'Keep Tom Bombadil at his house rather than move his advice into another region.',
    roster: 153
  },
  {
    areas: [[23, 23]],
    firstDay: [0, 0],
    reason:
      'Keep Bilbo at Rivendell, available when the Council opens his chance (finding:forces-advisors-met-once).',
    roster: 154
  },
  {
    areas: [[33, 33]],
    firstDay: [0, 20],
    reason:
      'Keep Galadriel in Lórien; vary availability without moving its ruler.',
    roster: 155
  },
  {
    areas: [[35, 35]],
    firstDay: [0, 20],
    reason:
      'Keep Treebeard at Derndingle in Fangorn; the named Place replaces his nearby Classic tile.',
    roster: 156
  },
  {
    areas: [
      [16, 20],
      [23, 30]
    ],
    firstDay: [0, 20],
    reason:
      'Let Radagast range along the northern road or the western mountain approaches; his returning advice stays unchanged (finding:forces-advisors-met-once).',
    roster: 157
  },
  {
    areas: [
      [15, 19],
      [16, 20]
    ],
    firstDay: [0, 15],
    reason:
      'Keep the Ranger on the northern frontier and the road toward Rivendell.',
    roster: 158
  },
  {
    areas: [
      [38, 42],
      [39, 40]
    ],
    firstDay: [0, 20],
    reason:
      'Keep the Rohirrim scouts within Rohan rather than send them into another Nation.',
    roster: 159
  },
  {
    areas: [
      [7, 7],
      [27, 29]
    ],
    firstDay: [0, 20],
    reason:
      'Keep the dwarf at Belegost or among the eastern Dwarven settlements; folk still require roads or settlements (finding:forces-folk-met-only-in-settlements).',
    roster: 160
  },
  {
    areas: [
      [5, 5],
      [10, 11]
    ],
    firstDay: [0, 10],
    reason:
      'Keep the hobbit in the western Shire or its eastern edge, beyond the Hobbiton exclusion zone.',
    roster: 161
  },
  {
    areas: [
      [8, 9],
      [23, 23],
      [26, 26]
    ],
    firstDay: [0, 20],
    reason:
      "Keep the elf near western Elven ports, Rivendell or Thranduil's Palace.",
    roster: 162
  },
  {
    areas: [
      [16, 20],
      [30, 37]
    ],
    firstDay: [0, 20],
    reason:
      'Let the wanderer use northern roads or the western approaches to Rohan.',
    roster: 163
  },
  {
    areas: [
      [14, 16],
      [38, 40]
    ],
    firstDay: [0, 20],
    reason: 'Keep the traveler on settled northern or Rohan routes.',
    roster: 164
  },
  {
    areas: [
      [5, 5],
      [16, 19]
    ],
    firstDay: [0, 15],
    reason:
      'Keep the old man among Shire settlements or along the road east of Bree.',
    roster: 165
  },
  {
    areas: [[36, 36]],
    firstDay: [0, 30],
    reason:
      'Keep Saruman at Isengard; vary the day he can be met without moving his seat.',
    roster: 166
  },
  {
    areas: [
      [21, 24],
      [24, 25]
    ],
    firstDay: [0, 30],
    reason:
      'Keep the large northern orc Encounter around the northern Misty Mountains.',
    roster: 167
  },
  {
    areas: [
      [25, 25],
      [24, 25]
    ],
    firstDay: [0, 25],
    reason:
      'Keep this small orc Encounter at Goblin Town or its northern mountain approaches.',
    roster: 168
  },
  {
    areas: [
      [31, 32],
      [30, 31]
    ],
    firstDay: [0, 25],
    reason: 'Keep the Moria orcs at its gates or along the Hollin approach.',
    roster: 169
  },
  {
    areas: [
      [26, 34],
      [34, 34]
    ],
    firstDay: [0, 30],
    reason:
      'Keep the eastern large orc Encounter in Mirkwood, with Dol Guldur as the concentrated alternative.',
    roster: 170
  },
  {
    areas: [
      [36, 38],
      [37, 39]
    ],
    firstDay: [0, 25],
    reason:
      'Keep the western war-road orcs around Isengard and the Isen crossings.',
    roster: 171
  },
  {
    areas: [
      [58, 63],
      [61, 66]
    ],
    firstDay: [0, 30],
    reason: 'Keep the southeastern orcs inside Mordor and its gates.',
    roster: 172
  },
  {
    areas: [
      [20, 22],
      [21, 25]
    ],
    firstDay: [0, 25],
    reason:
      'Keep the northern trolls near the Last Bridge or in the northern mountains.',
    roster: 173
  },
  {
    areas: [
      [26, 34],
      [34, 34]
    ],
    firstDay: [0, 30],
    reason: 'Keep the eastern trolls in Mirkwood and near Dol Guldur.',
    roster: 174
  },
  {
    areas: [[31, 32]],
    firstDay: [0, 25],
    reason:
      'Keep the lone Moria troll within the gate-to-gate mountain crossing.',
    roster: 175
  },
  {
    areas: [
      [60, 63],
      [61, 66]
    ],
    firstDay: [0, 30],
    reason:
      'Keep the southeastern troll in the Mordor interior and western approaches.',
    roster: 176
  },
  {
    areas: [[13, 13]],
    firstDay: [0, 15],
    reason:
      'Confine the wight to the Barrow Downs; spreading it onto the Shire road would change its identity.',
    roster: 177
  },
  {
    areas: [[41, 52]],
    firstDay: [0, 30],
    reason:
      'Keep the Dead Men on the Dunharrow-to-Erech corridor rather than throughout Gondor.',
    roster: 178
  },
  {
    areas: [
      [30, 36],
      [30, 37]
    ],
    firstDay: [0, 25],
    reason: 'Keep the Dunlendings in the western foothills north of the Isen.',
    roster: 179
  },
  {
    areas: [
      [57, 67],
      [56, 67]
    ],
    firstDay: [0, 30],
    reason:
      'Keep the Southrons on the southern approaches from the Harad Road.',
    roster: 180
  },
  {
    areas: [
      [28, 43],
      [34, 44]
    ],
    firstDay: [0, 25],
    reason:
      'Keep bandits in the eastern border country, away from the protected Shire opening.',
    roster: 181
  },
  {
    areas: [
      [58, 63],
      [61, 65]
    ],
    firstDay: [0, 30],
    reason:
      'Keep the large Mordor orc Encounter around its fortresses and gates.',
    roster: 182
  },
  {
    areas: [
      [24, 24],
      [21, 24]
    ],
    firstDay: [5, 40],
    reason:
      'Keep the northern balrog in the northern mountains; delay its earliest possible appearance.',
    roster: 183
  },
  {
    areas: [[31, 32]],
    firstDay: [5, 40],
    reason:
      'Keep the Moria balrog in the mountain crossing, with a provisional initial delay.',
    roster: 184
  },
  {
    areas: [
      [30, 31],
      [30, 36]
    ],
    firstDay: [5, 40],
    reason:
      'Keep the western balrog along the western mountain foothills; the wider southern reach needs review.',
    roster: 185
  },
  {
    areas: [
      [60, 65],
      [63, 66]
    ],
    firstDay: [5, 40],
    reason:
      'Keep the interior balrog within Mordor rather than move it onto the Good opening routes.',
    roster: 186
  },
  {
    areas: [
      [61, 62],
      [62, 66]
    ],
    firstDay: [5, 40],
    reason:
      'Keep the southern balrog around the Morgul gates or the southern Mordor interior.',
    roster: 187
  },
  {
    areas: [
      [21, 24],
      [24, 27]
    ],
    firstDay: [0, 25],
    reason:
      'Keep the northern wolves in the northern mountain and Erebor approaches.',
    roster: 188
  },
  {
    areas: [
      [30, 36],
      [30, 37]
    ],
    firstDay: [0, 25],
    reason:
      'Keep the western wolves in the foothills west of the Misty Mountains.',
    roster: 189
  },
  {
    areas: [
      [20, 22],
      [30, 31]
    ],
    firstDay: [0, 25],
    reason:
      'Keep the mountain wolves on the northern road or the Hollin approach.',
    roster: 190
  },
  {
    areas: [
      [34, 44],
      [42, 59]
    ],
    firstDay: [0, 30],
    reason:
      'Keep the southeastern wolves in the open country between Mirkwood, Rohan and Mordor.',
    roster: 191
  },
  {
    areas: [[26, 34]],
    firstDay: [0, 30],
    reason:
      "Keep the Mirkwood spiders in the forest region between Thranduil's Palace and Dol Guldur.",
    roster: 192
  },
  {
    areas: [
      [24, 25],
      [25, 25]
    ],
    firstDay: [0, 25],
    reason:
      'Keep the northern spider around the northern mountain dens rather than in open southern country.',
    roster: 193
  },
  {
    areas: [
      [61, 62],
      [62, 66]
    ],
    firstDay: [0, 30],
    reason:
      'Keep the southeastern spiders around the Morgul passes and southern Mordor.',
    roster: 194
  },
  {
    areas: [
      [61, 62],
      [62, 62]
    ],
    firstDay: [0, 30],
    reason:
      'Keep the lone pass spider on the Minas Morgul-to-Cirith Ungol approach.',
    roster: 195
  }
];
