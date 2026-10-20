import { GAME_SPEEDS, type GameSpeed } from './tick-driver';
import { drawWindowFrame, windowText, type WindowStyle } from './window-frame';

// The Game Speed window the hourglass icon opens (docs/spec/time.md):
// it lists the speeds, clicking one sets it and closes the window.
// It is framed as every window is (finding:ui-window-frame-tiles);
// its layout is provisional, as the original's has not been traced. The last line pauses or resumes (the original pauses
// with the P key).

export interface SpeedWindowOption {
  height: number;
  label: string;
  value: GameSpeed | 'pause';
  width: number;
  x: number;
  y: number;
}

export interface SpeedWindow {
  height: number;
  options: SpeedWindowOption[];
  width: number;
  x: number;
  y: number;
}

const LINE_HEIGHT = 10;
const PADDING = 8;
const WIDTH = 80;

export const layoutSpeedWindow = (
  anchorRight: number,
  anchorTop: number,
  paused: boolean
): SpeedWindow => {
  const labels: { label: string; value: GameSpeed | 'pause' }[] = [
    ...GAME_SPEEDS.map(({ label, speed }) => ({
      label,
      value: speed as GameSpeed | 'pause'
    })),
    { label: paused ? 'Resume' : 'Pause', value: 'pause' }
  ];
  const x = anchorRight - WIDTH;
  const y = anchorTop;
  return {
    height: labels.length * LINE_HEIGHT + PADDING * 2,
    options: labels.map(({ label, value }, i) => ({
      height: LINE_HEIGHT,
      label,
      value,
      width: WIDTH - PADDING * 2,
      x: x + PADDING,
      y: y + PADDING + i * LINE_HEIGHT
    })),
    width: WIDTH,
    x,
    y
  };
};

export const speedWindowOptionAt = (
  window: SpeedWindow,
  px: number,
  py: number
): SpeedWindowOption | undefined =>
  window.options.find(
    option =>
      px >= option.x &&
      px < option.x + option.width &&
      py >= option.y &&
      py < option.y + option.height
  );

export const drawSpeedWindow = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  window: SpeedWindow,
  currentSpeed: GameSpeed,
  paused: boolean
): void => {
  drawWindowFrame(ctx, style, window);
  for (const option of window.options) {
    const selected =
      option.value === 'pause'
        ? paused
        : option.value === currentSpeed && !paused;
    windowText(
      ctx,
      style,
      option.label,
      option.x + 2,
      option.y + 1,
      selected ? style.colours.red : style.colours.text
    );
  }
};
