import { drawHiresText } from './mirror-window';

// The Archive window the Full Map Level's scroll opens
// (finding:ui-archive-window), drawn into the 640 by 200 hi-res buffer
// at the top right, beside the icon column, as in the original. It
// asks "Would you like to..." with two buttons; choosing one answers
// with a message, and a press anywhere clears it. The frame and
// lettering are provisional, as for the other windows.

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

// The menu's right edge, and its width; a message window grows to its
// longest line, about 8 hi-res pixels a character, from the same edge.
const RIGHT = 592;
const WIDTH = 220;
const X = RIGHT - WIDTH;
const Y = 4;
const CHAR_WIDTH = 8;
const PADDING = 6;
const ROW_HEIGHT = 9;
const BUTTON_HEIGHT = 13;

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
    x: X + PADDING,
    y: Y + PADDING + ROW_HEIGHT + 4 + i * (BUTTON_HEIGHT + 4)
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

const windowHeight = (window: ArchiveWindow): number =>
  window.kind === 'menu'
    ? PADDING * 2 + ROW_HEIGHT + 4 + window.buttons.length * (BUTTON_HEIGHT + 4)
    : PADDING * 2 + window.lines.length * ROW_HEIGHT;

export const drawArchiveWindow = (
  ctx: CanvasRenderingContext2D,
  window: ArchiveWindow
): void => {
  const height = windowHeight(window);
  const width =
    window.kind === 'message'
      ? Math.max(
          WIDTH,
          PADDING * 2 +
            CHAR_WIDTH * Math.max(...window.lines.map(l => l.length))
        )
      : WIDTH;
  const x = RIGHT - width;
  ctx.fillStyle = '#000';
  ctx.fillRect(x, Y, width, height);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, Y + 0.5, width - 1, height - 1);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  if (window.kind === 'message') {
    ctx.fillStyle = '#fff';
    window.lines.forEach((line, i) => {
      drawHiresText(ctx, line, x + PADDING, Y + PADDING + i * ROW_HEIGHT);
    });
    return;
  }
  ctx.fillStyle = '#ff0';
  drawHiresText(ctx, ARCHIVE_HEADING, X + PADDING, Y + PADDING);
  ctx.fillStyle = '#fff';
  for (const button of window.buttons) {
    ctx.strokeRect(
      button.x + 0.5,
      button.y + 0.5,
      button.width - 1,
      button.height - 1
    );
    drawHiresText(ctx, button.label, button.x + 3, button.y + 3);
  }
};
