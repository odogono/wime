import { describe, expect, test } from 'bun:test';

import type { Force, Place, RosterEntry } from '../sim/index';
import {
  IDLE_ORDER,
  isInOrderWindow,
  layoutOrderWindow,
  orderWindowOptionAt,
  pickForceAt,
  pickForceByLeader,
  pickMember,
  toggleOrder
} from './order-window';
import { FIXED_FONT } from './test-font';

const entry = (over: Partial<RosterEntry>): RosterEntry =>
  ({
    destination: null,
    index: 0,
    isUnit: false,
    name: '',
    strength: 1,
    ...over
  }) as RosterEntry;

const frodo = entry({
  destination: { x: 784, y: 384 },
  index: 7,
  name: 'FRODO'
});
const force: Force = {
  active: true,
  leader: frodo,
  members: [
    frodo,
    entry({ index: 8, name: 'SAM' }),
    entry({ index: 14, isUnit: true, name: 'cavalry', strength: 120 })
  ],
  onMap: true,
  position: { x: 640, y: 368 }
};
const places: Place[] = [
  {
    announcesAttacks: false,
    gridByte: 50,
    gridReference: 'B3',
    index: 16,
    name: 'BREE',
    position: { x: 784, y: 384 },
    tile: { x: 49, y: 24 },
    tileKind: null
  }
];

describe('order flow', () => {
  test('the arrow starts picking a Force and cancels an Order in progress', () => {
    expect(toggleOrder(IDLE_ORDER)).toEqual({ kind: 'pick-force' });
    expect(toggleOrder({ kind: 'pick-force' })).toEqual({ kind: 'idle' });
    expect(
      toggleOrder({ kind: 'pick-destination', leaderIndex: 7, selected: 7 })
    ).toEqual({ kind: 'idle' });
  });

  test('clicking an active Force moves to picking its destination', () => {
    expect(
      pickForceAt({ kind: 'pick-force' }, [force], { x: 645, y: 370 })
    ).toEqual({
      kind: 'pick-destination',
      leaderIndex: 7,
      selected: 7
    });
  });

  // finding:movement-orders-accepted-by-allegiance-roll
  test('clicking empty map or an Evil Force keeps picking; an inactive Good Force is picked, for the roll to refuse', () => {
    expect(
      pickForceAt({ kind: 'pick-force' }, [force], { x: 0, y: 0 })
    ).toEqual({
      kind: 'pick-force'
    });
    const evil = {
      ...force,
      active: false,
      leader: { ...force.leader, index: 100 }
    };
    expect(
      pickForceAt({ kind: 'pick-force' }, [evil], { x: 645, y: 370 })
    ).toEqual({
      kind: 'pick-force'
    });
    expect(
      pickForceAt({ kind: 'pick-force' }, [{ ...force, active: false }], {
        x: 645,
        y: 370
      }).kind
    ).toBe('pick-destination');
  });

  // finding:movement-orders-accepted-by-allegiance-roll: the pick is
  // the first Good row near the click, rows in roster order (#230).
  test('where Forces overlap, the lowest-numbered Good Force is picked', () => {
    const eomer = { ...force, leader: entry({ index: 13, name: 'EOMER' }) };
    const garrison = {
      ...force,
      active: false,
      leader: entry({ index: 68, isUnit: true, name: 'lt. infantry' })
    };
    const evil = { ...force, leader: entry({ index: 100, name: 'ORCS' }) };
    expect(
      pickForceAt({ kind: 'pick-force' }, [eomer, garrison, evil], {
        x: 645,
        y: 370
      })
    ).toEqual({ kind: 'pick-destination', leaderIndex: 13, selected: 13 });
  });

  test('the arrow with a Good Force selected orders that Force at once', () => {
    expect(pickForceByLeader([force], 7)).toEqual({
      kind: 'pick-destination',
      leaderIndex: 7,
      selected: 7
    });
    const evil = { ...force, leader: entry({ index: 100, name: 'ORCS' }) };
    expect(pickForceByLeader([evil], 100)).toEqual({ kind: 'pick-force' });
    expect(pickForceByLeader([force], 8)).toEqual({ kind: 'pick-force' });
  });

  test('clicking a member name selects that member for the Order', () => {
    const state = {
      kind: 'pick-destination',
      leaderIndex: 7,
      selected: 7
    } as const;
    expect(pickMember(state, 8)).toEqual({ ...state, selected: 8 });
    expect(pickMember(IDLE_ORDER, 8)).toEqual(IDLE_ORDER);
  });
});

describe('order window', () => {
  test('lists members with the Leader heading, one option per member', () => {
    const window = layoutOrderWindow(FIXED_FONT, force, places);
    expect(window.x).toBe(8);
    expect(window.y).toBe(8);
    expect(window.options.map(option => option.label)).toEqual([
      'FRODO -> BREE',
      '  SAM',
      '  cavalry (120)'
    ]);
    expect(window.options.map(option => option.memberIndex)).toEqual([
      7, 8, 14
    ]);
  });

  test('options hit-test by line, and the window bounds its lines', () => {
    const window = layoutOrderWindow(FIXED_FONT, force, places);
    const sam = window.options[1]!;
    expect(orderWindowOptionAt(window, sam.x + 1, sam.y + 1)?.memberIndex).toBe(
      8
    );
    expect(orderWindowOptionAt(window, 300, 190)).toBeUndefined();
    expect(isInOrderWindow(window, window.x + 1, window.y + 1)).toBe(true);
    expect(isInOrderWindow(window, 300, 190)).toBe(false);
  });
});
