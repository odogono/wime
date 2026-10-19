// The original draws to a 320 by 200 lowres screen
// (finding:graphics-full-screen-art-is-320-by-200).
export const NATIVE_WIDTH = 320;
export const NATIVE_HEIGHT = 200;
// The Full Map Level is drawn hi-res, 640 by 200 with half-width pixels,
// in the same frame (finding:graphics-full-map-art-is-imag-2).
export const HIRES_WIDTH = 640;

// Which buffer a frame shows.
export type Resolution = 'hires' | 'lores';

export interface Fit {
  scale: number;
  x: number;
  y: number;
}

// The largest whole-number scale at which the native screen fits the
// available area (never below 1), and the offsets that centre it.
export const fitScale = (
  availWidth: number,
  availHeight: number,
  nativeWidth: number,
  nativeHeight: number
): Fit => {
  const scale = Math.max(
    1,
    Math.min(
      Math.floor(availWidth / nativeWidth),
      Math.floor(availHeight / nativeHeight)
    )
  );
  return {
    scale,
    x: Math.floor((availWidth - nativeWidth * scale) / 2),
    y: Math.floor((availHeight - nativeHeight * scale) / 2)
  };
};

export interface Screen {
  // The native-resolution buffer everything is drawn into.
  buffer: CanvasRenderingContext2D;
  // The 640 by 200 buffer for the Full Map Level.
  hires: CanvasRenderingContext2D;
  // Copy a buffer to the visible canvas, integer-scaled and centred.
  // Both fill the same frame, so a hi-res pixel is half as wide.
  present(resolution?: Resolution): void;
  // Resize the visible canvas to the window, in device pixels.
  resize(): Fit;
}

const context2d = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D is not available');
  }
  return ctx;
};

export const createScreen = (canvas: HTMLCanvasElement): Screen => {
  const bufferCanvas = document.createElement('canvas');
  bufferCanvas.width = NATIVE_WIDTH;
  bufferCanvas.height = NATIVE_HEIGHT;
  const buffer = context2d(bufferCanvas);
  const hiresCanvas = document.createElement('canvas');
  hiresCanvas.width = HIRES_WIDTH;
  hiresCanvas.height = NATIVE_HEIGHT;
  const hires = context2d(hiresCanvas);
  const visible = context2d(canvas);
  let fit = fitScale(NATIVE_WIDTH, NATIVE_HEIGHT, NATIVE_WIDTH, NATIVE_HEIGHT);

  const resize = (): Fit => {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
    fit = fitScale(canvas.width, canvas.height, NATIVE_WIDTH, NATIVE_HEIGHT);
    return fit;
  };

  const present = (resolution: Resolution = 'lores'): void => {
    // Resizing a canvas resets its context state, so set this every time.
    visible.imageSmoothingEnabled = false;
    visible.fillStyle = '#000';
    visible.fillRect(0, 0, canvas.width, canvas.height);
    visible.drawImage(
      resolution === 'hires' ? hiresCanvas : bufferCanvas,
      fit.x,
      fit.y,
      NATIVE_WIDTH * fit.scale,
      NATIVE_HEIGHT * fit.scale
    );
  };

  return { buffer, hires, present, resize };
};
