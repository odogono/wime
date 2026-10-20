// Animation Level figures and the scripts that move them
// (finding:graphics-figure-animation-scripts), following the original's
// interpreter at code+0x0bed8. Times are in vertical blanks, 50 a second.

export interface FrameRecord {
  height: number;
  hot_x: number;
  hot_y: number;
  width: number;
}

export interface Figure {
  // Which battle line a move stops at (events 8 to 0xb), or 0.
  clamp: number;
  delay: number;
  // A held figure (depth bit 0) is not counted as one of the party.
  depth: number;
  // Mirrored: the art faces left.
  flipped: boolean;
  // The current frame of the figure set.
  frame: number;
  frml: number;
  // The next vertical blank to run at; STOPPED for never.
  next: number;
  // The roster entry this figure stands for.
  owner: number;
  // The script offset of the last byte run, and the return addresses.
  pc: number;
  returns: number[];
  // Steps per frame the figure works toward, and its current delay.
  speed: number;
  // How many times its script has run event 0x10, which casts a spell:
  // the original spawns a flash (FRML 18) and plays Magic
  // (finding:sound-fight-effects).
  spells?: number;
  // Top left of the current frame.
  x: number;
  y: number;
}

export const STOPPED = 0xff_ff;
// At most seven return addresses are kept (code+0x0c6b2).
const RETURN_DEPTH = 7;
// Condition 0x18 holds when the figure shows this frame of its set.
const FRAME_18: Record<number, number> = {
  0: 14,
  1: 13,
  14: 14,
  2: 14,
  3: 14,
  5: 17
};

export interface ScriptWorld {
  frames: (frml: number) => FrameRecord[];
  // The x the slowest party member is measured against (code+0x0c038):
  // the party's count times 16 plus its leftmost x.
  laggardLine: number;
  // The two battle lines (data+0x5568, data+0x556a).
  line1: number;
  line2: number;
  random: (n: number) => number;
  script: (frml: number) => number[];
}

// A new figure, standing with its first frame's hot spot on (x, y)
// (code+0x037d8). It runs from script entry `entry`.
export const newFigure = (
  world: ScriptWorld,
  frml: number,
  entry: number,
  x: number,
  y: number,
  depth: number,
  owner: number
): Figure => {
  const frame = world.script(frml)[0] ?? 0;
  const record = world.frames(frml)[frame];
  return {
    clamp: 0,
    delay: 10,
    depth,
    flipped: false,
    frame,
    frml,
    next: 0,
    owner,
    pc: (entry - 1) & 0xff,
    returns: [],
    speed: 10,
    x: x - (record?.hot_x ?? 0),
    y: y - (record?.hot_y ?? 0)
  };
};

// Start a figure on another script entry (code+0x0a5ce, flags 0).
export const startScript = (figure: Figure, entry: number): Figure => ({
  ...figure,
  clamp: 0,
  next: 0,
  pc: (entry - 1) & 0xff,
  returns:
    figure.next === STOPPED
      ? figure.returns
      : [figure.pc, ...figure.returns].slice(0, RETURN_DEPTH)
});

// Show frame `frame`, keeping the anchor still: the hot spot, or for a
// mirrored figure the hot spot measured from the right (code+0x0ca36).
const setFrame = (
  figure: Figure,
  world: ScriptWorld,
  x: number,
  frame: number
): Figure => {
  const frames = world.frames(figure.frml);
  const old = frames[figure.frame];
  const record = frames[frame];
  if (!old || !record) {
    return { ...figure, frame, x };
  }
  let nextX = figure.flipped
    ? x + (old.width - old.hot_x) - (record.width - record.hot_x)
    : x + old.hot_x - record.hot_x;
  let y = figure.y + old.hot_y - record.hot_y;
  if (y + record.height > 182) {
    y = figure.depth + 15;
  }
  if (nextX < -1000) {
    nextX = figure.x < -100 ? 160 : figure.x;
  }
  return { ...figure, frame, x: nextX, y };
};

// Run a figure's script until it shows a frame or waits.
export const stepFigure = (
  start: Figure,
  world: ScriptWorld,
  vbl: number
): Figure => {
  const script = world.script(start.frml);
  let figure = start;
  let { flipped, pc, returns, x } = figure;
  const byteAt = (offset: number): number => script[offset & 0xff] ?? 0;
  // Return, then fetch at the saved address without stepping past it.
  const ret = (): void => {
    pc = returns[0] ?? 0;
    returns = returns.slice(1);
  };
  // Guard against a script that never shows a frame or waits.
  for (let budget = 0; budget < 1000; budget++) {
    pc = (pc + 1) & 0xff;
    let jumped = true;
    while (jumped) {
      jumped = false;
      const op = byteAt(pc);
      const n = op & 0x1f;
      switch (op & 0xe0) {
        case 0x00: {
          let delay = figure.delay;
          const held = (figure.depth & 1) === 1;
          if (!held) {
            if (x > world.laggardLine && delay < 30) {
              delay++;
            }
            if (x < world.laggardLine && delay > figure.speed) {
              delay--;
            }
          }
          const next =
            figure.speed === 31
              ? vbl + 60 + world.random(200)
              : vbl + figure.delay;
          if (delay < figure.speed) {
            delay++;
          }
          figure = { ...figure, delay, flipped, next, pc, returns };
          return setFrame(figure, world, x, n);
        }
        case 0x20:
        case 0x40: {
          // 0x40 steps right as the art faces, 0x20 back.
          const right = ((op & 0xe0) === 0x40) !== flipped;
          if (right) {
            x += n;
            if (
              (figure.clamp === 8 && x >= world.line1) ||
              (figure.clamp === 0x0a && x >= world.line2)
            ) {
              ret();
              jumped = true;
            }
          } else {
            if (x > -200) {
              x -= n;
            }
            if (
              (figure.clamp === 9 && x <= world.line1) ||
              (figure.clamp === 0x0b && x <= world.line2)
            ) {
              ret();
              jumped = true;
            }
          }
          break;
        }
        case 0x60: {
          const next = n === 0 ? STOPPED : vbl + n * 25 + world.random(n * 25);
          return { ...figure, next, pc, returns };
        }
        case 0x80: {
          figure = { ...figure, ...scriptEvent(n, figure) };
          if (n === 0x10) {
            figure = { ...figure, spells: (figure.spells ?? 0) + 1 };
          }
          if (n === 0x0e) {
            x = 350;
          }
          break;
        }
        case 0xa0: {
          if (n === 0x1f) {
            ret();
            jumped = true;
            break;
          }
          pc = (pc + 1) & 0xff;
          if (!condition(n & 0x1e, { figure, flipped, x }, world)) {
            break;
          }
          const target = byteAt(pc);
          // A call returns to the byte after the target.
          if (n & 1) {
            returns = [(pc + 1) & 0xff, ...returns].slice(0, RETURN_DEPTH);
          }
          pc = target;
          jumped = true;
          break;
        }
        case 0xc0: {
          figure = { ...figure, speed: n };
          break;
        }
        default: {
          flipped = n === 2 ? !flipped : (n & 1) === 1;
        }
      }
    }
  }
  return { ...figure, flipped, next: STOPPED, pc, returns, x };
};

const condition = (
  c: number,
  { figure, flipped, x }: { figure: Figure; flipped: boolean; x: number },
  world: ScriptWorld
): boolean => {
  switch (c) {
    case 0x00:
      return true;
    case 0x02:
      return flipped;
    case 0x04:
      // provisional: data+0x5563, the side's facing, is taken as unflipped.
      return flipped;
    case 0x06:
      return x < world.line1;
    case 0x08:
      return x > world.line1;
    case 0x0a:
      return x < world.line2;
    case 0x0c:
      return x > world.line2;
    case 0x0e:
      return world.random(100) < 5;
    case 0x10:
      return world.random(100) < 25;
    case 0x12:
      return world.random(100) < 50;
    case 0x14:
      return world.random(100) < 75;
    case 0x16:
      return world.random(100) < 95;
    case 0x18:
      return FRAME_18[figure.frml] === figure.frame;
    default:
      return false;
  }
};

// The events a walking figure needs (code+0x0c1ca); the rest belong to
// talks, objects and fights.
const scriptEvent = (n: number, figure: Figure): Partial<Figure> => {
  if (n >= 8 && n <= 0x0b) {
    return { clamp: n };
  }
  if (n === 6 || n === 7) {
    return { clamp: 0 };
  }
  if (n === 0x0f) {
    return { frml: 16 };
  }
  return figure.depth & 1 && n === 0 ? { depth: figure.depth & ~1 } : {};
};
