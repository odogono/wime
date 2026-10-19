import {
  fightRound,
  finishFight,
  placeAt,
  setCombatOption,
  type CombatEvent,
  type CombatRow,
  type Fight,
  type RosterEntry,
  type SimState
} from '../sim/index';

// The fight's announcement and the combat window on the Campaign Level
// (docs/spec/combat.md; #47). The sim stops while state.fight is set;
// this module decides what the player sees and when the rounds run.
// It is a pure state machine over real time in milliseconds, so main.ts
// only feeds it the clock and presses. Positions are the original's,
// in lo-res pixels (finding:ui-fight-announcement,
// finding:ui-combat-window-layout); the frame, colours and lettering
// follow the other windows' provisional style.

// The original counts 50 Hz frames.
const FRAME_MS = 20;
// An unanswered announcement presses "Ignore it" after 720 frames
// (finding:combat-unanswered-announcement-ignores-the-fight).
export const ANNOUNCEMENT_MS = 720 * FRAME_MS;
// The pause for orders after the opening message, the least time a
// loss message stays up (finding:combat-round-pacing), and how long
// the result stays in the window.
export const ORDERS_MS = 300 * FRAME_MS;
export const MESSAGE_MS = 180 * FRAME_MS;
export const RESULT_MS = 300 * FRAME_MS;
// How long each message box of an ignored fight stays up.
export const BOX_MS = 200 * FRAME_MS;

export const GOOD_WON = 'The good forces are victorious!';
export const EVIL_WON = 'The forces of EVIL have won.';

export interface Box {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface Button extends Box {
  choice: 'go-there' | 'ignore-it';
  label: string;
}

export const ANNOUNCEMENT_BOX: Box = { height: 34, width: 224, x: 56, y: 5 };
export const ANNOUNCEMENT_BUTTONS: Button[] = [
  {
    choice: 'go-there',
    height: 10,
    label: 'Go there',
    width: 48,
    x: 100,
    y: 27
  },
  {
    choice: 'ignore-it',
    height: 10,
    label: 'Ignore it',
    width: 52,
    x: 170,
    y: 27
  }
];

export type CombatUi =
  | { deadline: number; kind: 'announcement'; text: string }
  // The combat window: `message` is on its message line, and nothing
  // more happens until `until`.
  | {
      kind: 'window';
      message: string;
      messageColour: 'evil' | 'good' | 'plain';
      pending: string[];
      until: number;
    }
  // The message boxes an ignored fight leaves, one after another.
  | { boxes: string[]; kind: 'boxes'; until: number };

const capitalise = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

// How a row, or the Leader that leads it, is named: a Unit with its
// head count (finding:combat-unit-strength-shown-as-head-count).
export const rowLabel = (name: string, strength: number): string =>
  strength > 1 ? `${strength} ${name}` : name;

const entryName = (sim: SimState, index: number): string =>
  sim.roster[index]?.name ?? '';

// The announcement's text (finding:ui-fight-announcement).
export const announcementText = (sim: SimState, fight: Fight): string => {
  const evil = sim.roster[fight.evil]!;
  const enemy = rowLabel(evil.name, evil.strength);
  const place = placeAt(sim.places, fight.position);
  if (place?.announcesAttacks) {
    return `${place.name} is being attacked by ${enemy}.`;
  }
  const good = sim.roster[fight.good]!;
  const verb = good.strength > 1 ? 'are' : 'is';
  return `${capitalise(rowLabel(good.name, good.strength))} ${verb} attacked by ${enemy}.`;
};

export const startCombatUi = (sim: SimState, now: number): CombatUi | null =>
  sim.fight
    ? {
        deadline: now + ANNOUNCEMENT_MS,
        kind: 'announcement',
        text: announcementText(sim, sim.fight)
      }
    : null;

// A chooser for the message wordings the original picks at random;
// tests pass a fixed one.
export type Choose = (n: number) => number;

const UNIT_LOSSES = [
  (n: string, name: string, verb: string) =>
    `${n} of the ${name} ${verb} been cut down!`,
  (n: string, name: string, verb: string) =>
    `${n} of the ${name} ${verb} been slain in a frenzied assault!`,
  (n: string, name: string) =>
    `The blood of ${n} of the ${name} flows red on the stones.`
];

// A loss message for one row (finding:combat-casualty-messages).
// Units are only named for losses from their share of the blows.
export const casualtyMessage = (
  row: CombatRow,
  event: CombatEvent,
  name: string,
  choose: Choose
): string | null => {
  if (row.startStrength > 1) {
    if (event.blow !== 'share' || event.killed === 0) {
      return null;
    }
    const n = row.strength === 0 ? 'all' : String(event.killed);
    const verb = event.killed === 1 ? 'has' : 'have';
    return UNIT_LOSSES[choose(3)]!(n, name, verb);
  }
  const who = capitalise(name);
  const good = row.side === 'good';
  if (event.killed > 0) {
    if (event.blow === 'share') {
      return good
        ? `${who} is killed by a foul blow!`
        : `${who} is felled by a mighty attack!`;
    }
    return good
      ? `${who} is struck down by a frenzied attack!`
      : `${who} is clove asunder by a skillful stroke!`;
  }
  if (event.wounded === 0) {
    return null;
  }
  if (event.blow === 'share') {
    return good
      ? `${who} is struck a grave wound!`
      : `${who} staggers back as if wounded!`;
  }
  if (!good) {
    return `${who} cries in bitter pain from a swift thrust!`;
  }
  return choose(2) === 0
    ? `${who} staggers back from an insidious blow!`
    : `${who} is caught by the fell enemy's blow!`;
};

const roundMessages = (sim: SimState, fight: Fight, choose: Choose): string[] =>
  fight.events.flatMap(event => {
    const row = fight.rows[event.row]!;
    const message = casualtyMessage(
      row,
      event,
      entryName(sim, row.entries[0]!),
      choose
    );
    return message ? [message] : [];
  });

// The Nazgûl, whom an ignored fight drives from the field rather than
// kills (finding:combat-ignored-fight-resolved-at-once).
const isNazgul = (entry: RosterEntry): boolean =>
  entry.index >= 79 && entry.index <= 87;

const deathBoxes = (before: SimState, after: SimState): string[] => {
  const fight = before.fight!;
  return fight.rows
    .flatMap(row => row.entries)
    .filter(index => {
      const entry = before.roster[index]!;
      return (
        entry.startingStrength === 1 && after.roster[index]!.strength === 0
      );
    })
    .map(index => {
      const entry = before.roster[index]!;
      return isNazgul(entry)
        ? `${capitalise(entry.name)} has been driven from the field.`
        : `${capitalise(entry.name)} has died in combat.`;
    });
};

// "Ignore it": the fight is fought out at once, all on Engage, and only
// its result and its dead are shown.
const ignore = (
  sim: SimState,
  now: number
): { sim: SimState; ui: CombatUi } => {
  let fought = sim;
  while (fought.fight && !fought.fight.winner) {
    fought = fightRound(fought);
  }
  const result = fought.fight!.winner === 'good' ? GOOD_WON : EVIL_WON;
  const finished = finishFight(fought);
  return {
    sim: finished,
    ui: {
      boxes: [result, ...deathBoxes(fought, finished)],
      kind: 'boxes',
      until: now + BOX_MS
    }
  };
};

const goThere = (sim: SimState, now: number): CombatUi => {
  const fight = sim.fight!;
  const good = fight.rows.find(row => row.side === 'good');
  const evil = fight.rows.find(row => row.side === 'evil');
  const a = capitalise(good ? entryName(sim, good.entries[0]!) : '');
  const b = evil ? entryName(sim, evil.entries[0]!) : '';
  return {
    kind: 'window',
    message: `${a} and ${b} move grimly into battle.`,
    messageColour: 'plain',
    pending: [],
    until: now + ORDERS_MS
  };
};

// Advance the fight's presentation to `now`: the announcement times out
// into "Ignore it", window messages give way to the next round, and an
// ignored fight's boxes run out. Returns null once the fight is over
// and nothing is left to show.
export const stepCombatUi = (
  ui: CombatUi,
  sim: SimState,
  now: number,
  choose: Choose
): { sim: SimState; ui: CombatUi | null } => {
  if (ui.kind === 'announcement') {
    return now >= ui.deadline ? ignore(sim, now) : { sim, ui };
  }
  if (ui.kind === 'boxes') {
    if (now < ui.until) {
      return { sim, ui };
    }
    const [, ...rest] = ui.boxes;
    return {
      sim,
      ui: rest.length > 0 ? { ...ui, boxes: rest, until: now + BOX_MS } : null
    };
  }
  let next = sim;
  let window = ui;
  // Rounds without losses aren't paced, so run them until there is
  // something to say or the fight is over.
  while (now >= window.until) {
    const fight = next.fight;
    if (!fight) {
      return { sim: next, ui: null };
    }
    if (window.pending.length > 0) {
      const [message, ...pending] = window.pending;
      window = {
        ...window,
        message: message!,
        messageColour: 'plain',
        pending,
        until: window.until + MESSAGE_MS
      };
      continue;
    }
    if (fight.winner) {
      if (window.message === GOOD_WON || window.message === EVIL_WON) {
        return { sim: finishFight(next), ui: null };
      }
      window = {
        ...window,
        message: fight.winner === 'good' ? GOOD_WON : EVIL_WON,
        messageColour: fight.winner,
        until: now + RESULT_MS
      };
      continue;
    }
    next = fightRound(next);
    const messages = roundMessages(next, next.fight!, choose);
    if (messages.length > 0) {
      const [message, ...pending] = messages;
      window = {
        ...window,
        message: message!,
        messageColour: 'plain',
        pending,
        until: Math.max(window.until, now) + MESSAGE_MS
      };
    }
  }
  return { sim: next, ui: window };
};

// Whether game time may run: only while the last message box of an
// ignored fight is up, or with no fight at all.
export const combatHoldsTime = (ui: CombatUi | null): boolean =>
  ui !== null && !(ui.kind === 'boxes' && ui.boxes.length === 1);

// The combat window's geometry (finding:ui-combat-window-layout).
export const WINDOW_X = 6;
export const WINDOW_Y = 0;
export const WINDOW_WIDTH = 272;
const OPTION_XS = [18, 47, 76, 105];
const OPTION_WIDTH = 12;
const OPTION_HEIGHT = 7;
const GOOD_NAME_X = 130;
const EVIL_NAME_X = 200;
const FOLLOWER_INDENT = 5;
const FIRST_ROW_Y = 16;

export const OPTIONS = ['charge', 'engage', 'withdraw', 'retreat'] as const;
export const OPTION_LABELS = ['Charge', 'Engage', 'Wthdrw', 'Retreat'];

export interface WindowLayout {
  height: number;
  lineHeight: number;
  messageY: number;
  rows: number;
}

export const layoutCombatWindow = (fight: Fight): WindowLayout => {
  const good = fight.rows.filter(row => row.side === 'good').length;
  const evil = fight.rows.length - good;
  const rows = Math.max(good, evil, 1);
  const lineHeight = Math.max(good, evil) > 16 ? 8 : 9;
  return {
    height: rows * lineHeight + 32,
    lineHeight,
    messageY: rows * lineHeight + 18,
    rows
  };
};

const inBox = (box: Box, point: { x: number; y: number }): boolean =>
  point.x >= box.x &&
  point.x < box.x + box.width &&
  point.y >= box.y &&
  point.y < box.y + box.height;

// The option button under a point, as a Good row and an option.
export const optionAt = (
  fight: Fight,
  point: { x: number; y: number }
): { option: (typeof OPTIONS)[number]; row: number } | null => {
  const layout = layoutCombatWindow(fight);
  let goodRow = 0;
  for (let row = 0; row < fight.rows.length; row++) {
    if (fight.rows[row]!.side !== 'good') {
      continue;
    }
    const y = WINDOW_Y + FIRST_ROW_Y + goodRow * layout.lineHeight;
    for (let k = 0; k < OPTIONS.length; k++) {
      const box = {
        height: OPTION_HEIGHT,
        width: OPTION_WIDTH,
        x: WINDOW_X + OPTION_XS[k]!,
        y
      };
      if (inBox(box, point)) {
        return { option: OPTIONS[k]!, row };
      }
    }
    goodRow += 1;
  }
  return null;
};

// A press while a fight is on. Returns the new state, or null when the
// press is not the fight's.
export const pressCombatUi = (
  ui: CombatUi,
  sim: SimState,
  point: { x: number; y: number },
  now: number
): { sim: SimState; ui: CombatUi | null } => {
  if (ui.kind === 'announcement') {
    const button = ANNOUNCEMENT_BUTTONS.find(candidate =>
      inBox(candidate, point)
    );
    if (!button) {
      return { sim, ui };
    }
    return button.choice === 'ignore-it'
      ? ignore(sim, now)
      : { sim, ui: goThere(sim, now) };
  }
  if (ui.kind === 'window' && sim.fight) {
    const hit = optionAt(sim.fight, point);
    return hit
      ? { sim: setCombatOption(sim, hit.row, hit.option), ui }
      : { sim, ui };
  }
  // A press clears a message box early.
  if (ui.kind === 'boxes') {
    const [, ...rest] = ui.boxes;
    return {
      sim,
      ui: rest.length > 0 ? { ...ui, boxes: rest, until: now + BOX_MS } : null
    };
  }
  return { sim, ui };
};

// Where the window wants the Campaign Level camera: on the fight when
// it is out of view (finding:combat-where-a-fight-is-fought).
export const cameraForFight = (
  position: { x: number; y: number },
  camera: { x: number; y: number },
  view: { height: number; width: number }
): { x: number; y: number } =>
  position.x >= camera.x &&
  position.x < camera.x + view.width &&
  position.y >= camera.y &&
  position.y < camera.y + view.height
    ? camera
    : { x: (position.x - 0x90) & ~15, y: (position.y - 0x70) & ~15 };

const COLOURS = {
  dead: '#888',
  evil: '#f55',
  good: '#59f',
  hale: '#fff',
  wounded: '#f55'
};

const frame = (ctx: CanvasRenderingContext2D, box: Box): void => {
  ctx.fillStyle = '#000';
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.width - 1, box.height - 1);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
};

const nameColour = (row: CombatRow, entry: RosterEntry): string => {
  if (row.strength === 0 || entry.health === 0) {
    return COLOURS.dead;
  }
  return entry.health < entry.maxHealth ? COLOURS.wounded : COLOURS.hale;
};

export const drawCombatUi = (
  ctx: CanvasRenderingContext2D,
  ui: CombatUi,
  sim: SimState
): void => {
  if (ui.kind === 'announcement') {
    frame(ctx, ANNOUNCEMENT_BOX);
    ctx.fillStyle = '#fff';
    ctx.fillText(ui.text, ANNOUNCEMENT_BOX.x + 10, ANNOUNCEMENT_BOX.y + 8, 206);
    for (const button of ANNOUNCEMENT_BUTTONS) {
      ctx.strokeRect(
        button.x + 0.5,
        button.y + 0.5,
        button.width - 1,
        button.height - 1
      );
      ctx.fillText(button.label, button.x + 3, button.y + 1, button.width - 6);
    }
    return;
  }
  if (ui.kind === 'boxes') {
    const text = ui.boxes[0]!;
    const box = {
      height: 24,
      width: Math.max(160, text.length * 5 + 20),
      x: 10,
      y: 5
    };
    frame(ctx, box);
    ctx.fillStyle =
      text === GOOD_WON
        ? COLOURS.good
        : text === EVIL_WON
          ? COLOURS.evil
          : '#fff';
    ctx.fillText(text, box.x + 10, box.y + 8, box.width - 20);
    return;
  }
  const fight = sim.fight;
  if (!fight) {
    return;
  }
  const layout = layoutCombatWindow(fight);
  frame(ctx, {
    height: layout.height,
    width: WINDOW_WIDTH,
    x: WINDOW_X,
    y: WINDOW_Y
  });
  ctx.fillStyle = COLOURS.good;
  OPTION_LABELS.forEach((label, k) => {
    ctx.fillText(label, WINDOW_X + OPTION_XS[k]! - 5, WINDOW_Y + 6, 25);
  });
  ctx.fillText('--Good----------', WINDOW_X + GOOD_NAME_X, WINDOW_Y + 6, 66);
  ctx.fillStyle = COLOURS.evil;
  ctx.fillText('--Evil---------', WINDOW_X + EVIL_NAME_X - 1, WINDOW_Y + 6, 66);
  let goodRow = 0;
  let evilRow = 0;
  for (const row of fight.rows) {
    const entry = sim.roster[row.entries[0]!]!;
    const good = row.side === 'good';
    const index = good ? goodRow++ : evilRow++;
    const y = WINDOW_Y + FIRST_ROW_Y + index * layout.lineHeight;
    if (good) {
      ctx.strokeStyle = '#fff';
      OPTIONS.forEach((option, k) => {
        const x = WINDOW_X + OPTION_XS[k]!;
        ctx.strokeRect(x + 0.5, y + 0.5, OPTION_WIDTH - 1, OPTION_HEIGHT - 1);
        // A row in the round after a Charge, or gone, has no marker.
        if (row.option === option) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(x + 2, y + 2, OPTION_WIDTH - 4, OPTION_HEIGHT - 4);
        }
      });
    }
    ctx.fillStyle = nameColour(row, entry);
    const x =
      WINDOW_X +
      (good ? GOOD_NAME_X : EVIL_NAME_X) +
      (row.follower ? FOLLOWER_INDENT : 0);
    ctx.fillText(rowLabel(entry.name, row.strength), x, y - 1, 66);
  }
  ctx.fillStyle =
    ui.messageColour === 'good'
      ? COLOURS.good
      : ui.messageColour === 'evil'
        ? COLOURS.evil
        : '#fff';
  ctx.fillText(ui.message, WINDOW_X + 24, WINDOW_Y + layout.messageY, 230);
};
