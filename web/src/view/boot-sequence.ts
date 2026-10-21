import { textKey, type TitleAssets } from './assets';
import { drawText } from './font';
import { FRAME_MS } from './tick-driver';
import { drawWindowFrame, windowText } from './window-frame';

// The boot sequence (docs/spec/boot-sequence.md): the Melbourne House
// and Synergistic screens, the title screen and its logo, the Credits
// and the Ring verse, on a timetable counted in frames from when Title
// starts. A pure state machine over real time in milliseconds; the
// drawing follows it.

// When each screen is due, in frames (finding:ui-boot-sequence-screens).
export const BOOT_FRAMES = {
  credits: 1000,
  logo: 600,
  synergistic: 240,
  title: 540
};
// A fade to black takes at most 15 RGB4 steps of 2 frames, and a fade in
// 32 steps of 2 frames (finding:graphics-boot-screens-fade).
const FADE_OUT_FRAMES = 30;
const FADE_IN_FRAMES = 64;
// 600 one-pixel steps, over the 2457 frames they took on an A500
// (finding:ui-boot-credits-scroll).
export const CREDITS_STEPS = 600;
export const CREDITS_FRAMES = 2457;
// The original shows the Ring verse while the Animation Level loads,
// several seconds on a floppy (finding:ui-ring-verse-window); the port
// loads at once, so it holds the verse this long instead. The port's
// own choice.
export const VERSE_HOLD_FRAMES = 150;

// The pictures, ATitle.res IMAG 70 to 73, and where they are drawn.
export const BOOT_PICTURES = {
  logo: { id: 73, x: 48, y: 20 },
  melbourneHouse: { id: 70, x: 92, y: 22 },
  synergistic: { id: 71, x: 44, y: 41 },
  title: { id: 72, x: 0, y: 0 }
};

export interface BootSequence {
  done: boolean;
  // What a key kept (finding:ui-boot-sequence-key-skips): before the
  // logo it skips the rest of the sequence; while the logo shows it
  // skips the Credits and Title does not hold the Ring verse.
  kept: 'all' | 'credits' | null;
  // When the page opened: the Melbourne House screen fades in and waits
  // there for the first input, which browsers require before Title can
  // play.
  openedAt: number;
  // When Title started, frame 0 of the timetable.
  startedAt: number | null;
  // The frame the Ring verse went up, once it has.
  verseAt: number | null;
  // The frame the title screen began to fade out for the Ring verse, if
  // a key brought it forward.
  verseFadeFrom: number | null;
}

export const bootSequence = (now: number): BootSequence => ({
  done: false,
  kept: null,
  openedAt: now,
  startedAt: null,
  verseAt: null,
  verseFadeFrom: null
});

export const bootFrame = (boot: BootSequence, now: number): number =>
  boot.startedAt === null ? 0 : Math.floor((now - boot.startedAt) / FRAME_MS);

const verseFadeFrom = (boot: BootSequence): number =>
  boot.verseFadeFrom ?? BOOT_FRAMES.credits + CREDITS_FRAMES;

// The first input starts Title and the timetable; it skips nothing.
// Returns whether this input started it.
export const startBoot = (
  boot: BootSequence,
  now: number
): { boot: BootSequence; started: boolean } =>
  boot.startedAt === null
    ? { boot: { ...boot, startedAt: now }, started: true }
    : { boot, started: false };

// A key press (finding:ui-boot-sequence-key-skips). Clicks only start
// the sequence; once the Ring verse is up, keys do nothing either.
export const pressBootKey = (boot: BootSequence, now: number): BootSequence => {
  const started = startBoot(boot, now);
  if (started.started || boot.done) {
    return started.boot;
  }
  const frame = bootFrame(boot, now);
  if (frame < BOOT_FRAMES.logo) {
    return { ...boot, done: true, kept: 'all' };
  }
  if (frame >= verseFadeFrom(boot)) {
    return boot;
  }
  // While the logo shows, the key is kept and skips the Credits; during
  // them it only ends them.
  return {
    ...boot,
    kept: frame < BOOT_FRAMES.credits ? 'credits' : boot.kept,
    verseFadeFrom: frame
  };
};

// Advance to `now`. The Ring verse stays up for at least the hold and,
// unless a key was kept, until Title ends
// (finding:sound-title-music-in-the-boot-sequence).
export const stepBoot = (
  boot: BootSequence,
  now: number,
  titlePlaying: boolean
): BootSequence => {
  if (boot.done || boot.startedAt === null) {
    return boot;
  }
  const frame = bootFrame(boot, now);
  const verseAt = verseFadeFrom(boot) + FADE_OUT_FRAMES;
  if (frame < verseAt) {
    return boot;
  }
  const shown = boot.verseAt ?? verseAt;
  const held = frame >= shown + VERSE_HOLD_FRAMES;
  const titleOver = boot.kept !== null || !titlePlaying;
  return { ...boot, done: held && titleOver, verseAt: shown };
};

// A fade's progress: `out` takes `step` from every RGB4 component, `in`
// brings each up from black by `step` (finding:graphics-boot-screens-fade).
export type Fade = { kind: 'in' | 'out'; step: number };

export interface BootView {
  // How many steps the Credits have risen, while they show.
  creditsStep: number | null;
  fade: Fade | null;
  // The logo's top, while it shows.
  logoY: number | null;
  picture: keyof typeof BOOT_PICTURES | null;
  verse: boolean;
}

const fadeIn = (frame: number, from: number): Fade | null =>
  frame < from + FADE_IN_FRAMES
    ? { kind: 'in', step: Math.floor((frame - from) / 2) }
    : null;

const fadeOut = (frame: number, from: number): Fade => ({
  kind: 'out',
  step: Math.floor((frame - from) / 2) + 1
});

// What the screen shows at `now`.
export const bootView = (boot: BootSequence, now: number): BootView => {
  const view: BootView = {
    creditsStep: null,
    fade: null,
    logoY: null,
    picture: 'melbourneHouse',
    verse: false
  };
  if (boot.startedAt === null) {
    // Waiting for the first input, the Melbourne House screen fades in.
    const frame = Math.floor((now - boot.openedAt) / FRAME_MS);
    return { ...view, fade: fadeIn(frame, 0) };
  }
  const frame = bootFrame(boot, now);
  const verseFrom = verseFadeFrom(boot);
  if (
    boot.done ||
    boot.verseAt !== null ||
    frame >= verseFrom + FADE_OUT_FRAMES
  ) {
    return { ...view, picture: null, verse: true };
  }
  if (frame < BOOT_FRAMES.synergistic) {
    return view;
  }
  if (frame < BOOT_FRAMES.synergistic + FADE_OUT_FRAMES) {
    return { ...view, fade: fadeOut(frame, BOOT_FRAMES.synergistic) };
  }
  if (frame < BOOT_FRAMES.title) {
    return {
      ...view,
      fade: fadeIn(frame, BOOT_FRAMES.synergistic + FADE_OUT_FRAMES),
      picture: 'synergistic'
    };
  }
  if (frame < BOOT_FRAMES.title + FADE_OUT_FRAMES) {
    return {
      ...view,
      fade: fadeOut(frame, BOOT_FRAMES.title),
      picture: 'synergistic'
    };
  }
  const titleView: BootView = {
    ...view,
    fade: fadeIn(frame, BOOT_FRAMES.title + FADE_OUT_FRAMES),
    picture: 'title'
  };
  if (frame < BOOT_FRAMES.logo) {
    return titleView;
  }
  // The Credits begin unless a key was kept while the logo showed.
  const creditsStep =
    frame >= BOOT_FRAMES.credits && boot.kept === null
      ? Math.min(
          CREDITS_STEPS,
          Math.floor(
            ((Math.min(frame, verseFrom) - BOOT_FRAMES.credits) *
              CREDITS_STEPS) /
              CREDITS_FRAMES
          )
        )
      : null;
  // From the 16th step the logo rises with the Credits
  // (finding:ui-boot-credits-scroll).
  const logoY =
    creditsStep !== null && creditsStep >= 16
      ? 35 - creditsStep
      : BOOT_PICTURES.logo.y;
  return {
    ...titleView,
    creditsStep,
    fade: frame >= verseFrom ? fadeOut(frame, verseFrom) : titleView.fade,
    logoY
  };
};

// One RGB4 component, 0 to 15, as a fade shows it.
export const fadeComponent = (value: number, fade: Fade | null): number =>
  !fade
    ? value
    : fade.kind === 'out'
      ? Math.max(0, value - fade.step)
      : Math.min(value, fade.step);

// The Credits' column: the roles at x 0 and the names at x 94, each
// drawn six times in colour 2 around a seventh in colour 1
// (finding:ui-boot-credits-scroll).
const CREDITS_WIDTH = 160;
const CREDITS_HEIGHT = 400;
export const CREDITS_X = 84;
const OUTLINE: [number, number][] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 2],
  [2, 1],
  [2, 2]
];

const renderCredits = (
  assets: TitleAssets,
  texts: Map<string, string>
): HTMLCanvasElement => {
  const column = document.createElement('canvas');
  column.width = CREDITS_WIDTH;
  column.height = CREDITS_HEIGHT;
  const ctx = column.getContext('2d')!;
  for (const [id, x] of [
    [59, 0],
    [60, 94]
  ] as const) {
    const text = texts.get(textKey('AText.res', id)) ?? '';
    for (const [dx, dy] of OUTLINE) {
      drawText(ctx, assets.font, text, x + dx, dy, assets.palette[2]!);
    }
    drawText(ctx, assets.font, text, x + 1, 1, assets.palette[1]!);
  }
  return column;
};

// The Ring verse's window and where its two parts are lettered
// (finding:ui-ring-verse-window).
export const VERSE_BOX = { height: 120, width: 240, x: 40, y: 20 };

// The fade, applied to what is already drawn. Every colour in the title
// palette is an RGB4 one, 17 to a step.
const applyFade = (ctx: CanvasRenderingContext2D, fade: Fade): void => {
  const { height, width } = ctx.canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      data[i + c] = fadeComponent(Math.round(data[i + c]! / 17), fade) * 17;
    }
  }
  ctx.putImageData(image, 0, 0);
};

// Draws the boot sequence in the title palette
// (finding:graphics-title-screen-palette).
export const createBootRenderer = (
  assets: TitleAssets,
  texts: Map<string, string>
): ((ctx: CanvasRenderingContext2D, view: BootView) => void) => {
  let credits: HTMLCanvasElement | null = null;
  return (ctx, view) => {
    ctx.fillStyle = assets.palette[0]!;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (view.verse) {
      const box = drawWindowFrame(ctx, assets.window, VERSE_BOX);
      for (const [id, y] of [
        [57, 20],
        [58, 70]
      ] as const) {
        const text = texts.get(textKey('AText.res', id)) ?? '';
        windowText(ctx, assets.window, text, box.x + 20, box.y + y);
      }
      return;
    }
    if (view.picture) {
      const { id, x, y } = BOOT_PICTURES[view.picture];
      ctx.drawImage(assets.pictures.get(id)!, x, y);
    }
    if (view.logoY !== null) {
      const { id, x } = BOOT_PICTURES.logo;
      ctx.drawImage(assets.pictures.get(id)!, x, view.logoY);
    }
    if (view.creditsStep !== null) {
      credits ??= renderCredits(assets, texts);
      ctx.drawImage(credits, CREDITS_X, 200 - view.creditsStep);
    }
    if (view.fade) {
      applyFade(ctx, view.fade);
    }
  };
};
