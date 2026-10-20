import {
  drawWindowFrame,
  hiresWindowText,
  measureHiresLines,
  type WindowStyle
} from './window-frame';

// The Archive window the Full Map Level's scroll opens
// (finding:ui-archive-window), drawn into the 640 by 200 hi-res buffer
// at the top right, beside the icon column, as in the original. It
// asks "Would you like to..." with two buttons; choosing one answers
// with a message, and a press anywhere clears it. The box is the
// original's, framed as every window is (finding:ui-window-frame-tiles);
// the buttons are provisional. It is lettered in topaz/8 when it was
// exported, and otherwise in our own font in its spirit
// (finding:ui-full-map-topaz-is-kickstart-1-3, topaz-alt.ts).

export type ArchiveChoice = 'restore' | 'save';

export interface ArchiveButton {
  choice: ArchiveChoice;
  height: number;
  label: string;
  width: number;
  x: number;
  y: number;
}

export type ArchiveWindow =
  | { buttons: ArchiveButton[]; kind: 'menu' }
  | { kind: 'message'; lines: string[] };

// The original's messages (finding:ui-archive-window). It has none for
// a save made by another version, so that one is ours, in its style.
export const ARCHIVE_MESSAGES = {
  noArchive: [
    'No Archive file exists, you must',
    'save one before you may restore.'
  ],
  otherVersion: [
    'The Archive file was saved by',
    'another version of the game and',
    'cannot be restored.'
  ],
  restored: ['The old game was restored successfully.'],
  saved: ['The game was successfully saved.'],
  saveFailed: [
    'There was an error in saving',
    'the Archive file. Please check',
    'the disk drive and try again.'
  ]
} as const;

// The original opens the menu at (168, 5), 112 wide and 53 deep
// (code+0x07eb8); on the Full Map Level x and width are doubled
// (finding:ui-window-box-geometry). Its text is 20 hi-res pixels in
// and 8 down. A message window grows to its longest line from the same
// right edge.
const X = 336;
const Y = 5;
const WIDTH = 224;
const HEIGHT = 53;
const RIGHT = X + WIDTH;
const INSET_X = 20;
const INSET_Y = 8;
const ROW_HEIGHT = 9;
const BUTTON_HEIGHT = 11;
const BUTTON_GAP = 3;

export const ARCHIVE_HEADING = 'Would you like to...';

export const archiveMenu = (): ArchiveWindow => ({
  buttons: [
    { choice: 'restore', label: 'Restore an old game' },
    { choice: 'save', label: 'Save current game' }
  ].map(({ choice, label }, i) => ({
    choice: choice as ArchiveChoice,
    height: BUTTON_HEIGHT,
    label,
    width: 168,
    x: X + INSET_X,
    y: Y + INSET_Y + ROW_HEIGHT + 4 + i * (BUTTON_HEIGHT + BUTTON_GAP)
  })),
  kind: 'menu'
});

export const archiveMessage = (lines: readonly string[]): ArchiveWindow => ({
  kind: 'message',
  lines: [...lines]
});

export const archiveButtonAt = (
  window: ArchiveWindow,
  point: { x: number; y: number }
): ArchiveButton | undefined =>
  window.kind === 'menu'
    ? window.buttons.find(
        button =>
          point.x >= button.x &&
          point.x < button.x + button.width &&
          point.y >= button.y &&
          point.y < button.y + button.height
      )
    : undefined;

export const drawArchiveWindow = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  window: ArchiveWindow
): void => {
  if (window.kind === 'message') {
    const width = Math.max(
      WIDTH,
      INSET_X * 2 + measureHiresLines(style, window.lines)
    );
    const box = drawWindowFrame(ctx, style, {
      height: INSET_Y * 2 + window.lines.length * ROW_HEIGHT,
      width,
      x: RIGHT - width,
      y: Y
    });
    window.lines.forEach((line, i) => {
      hiresWindowText(
        ctx,
        style,
        line,
        box.x + INSET_X,
        box.y + INSET_Y + i * ROW_HEIGHT
      );
    });
    return;
  }
  drawWindowFrame(ctx, style, { height: HEIGHT, width: WIDTH, x: X, y: Y });
  hiresWindowText(
    ctx,
    style,
    ARCHIVE_HEADING,
    X + INSET_X,
    Y + INSET_Y,
    style.colours.red
  );
  ctx.strokeStyle = style.colours.text;
  ctx.lineWidth = 1;
  for (const button of window.buttons) {
    ctx.strokeRect(
      button.x + 0.5,
      button.y + 0.5,
      button.width - 1,
      button.height - 1
    );
    hiresWindowText(ctx, style, button.label, button.x + 3, button.y + 2);
  }
};
