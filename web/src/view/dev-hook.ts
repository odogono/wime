// Development aids, installed only under `bun run dev`
// (docs/agents/port-preview.md).
import { NATIVE_HEIGHT, NATIVE_WIDTH, type Fit } from './screen';

// Save the game's screen, cropped out of the canvas's black margins, to
// build/port/NAME.png through the dev server's /__snap endpoint
// (web/vite.config.ts). WIDTH defaults to the native 320; pass 640 for the
// Full Map Level's hi-res pixels. Resolves to the path written.
export const snapCanvas = async (
  canvas: HTMLCanvasElement,
  fit: Fit,
  name: string,
  width = NATIVE_WIDTH
): Promise<string> => {
  const small = document.createElement('canvas');
  small.width = width;
  small.height = (NATIVE_HEIGHT * width) / NATIVE_WIDTH;
  const ctx = small.getContext('2d');
  if (!ctx) {
    throw new Error('no 2d context');
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    canvas,
    fit.x,
    fit.y,
    NATIVE_WIDTH * fit.scale,
    NATIVE_HEIGHT * fit.scale,
    0,
    0,
    small.width,
    small.height
  );
  const blob = await new Promise<Blob | null>(resolve =>
    small.toBlob(resolve, 'image/png')
  );
  if (!blob) {
    throw new Error('the canvas gave no PNG');
  }
  const response = await fetch(`/__snap?name=${encodeURIComponent(name)}`, {
    body: blob,
    method: 'POST'
  });
  if (!response.ok) {
    throw new Error(`/__snap answered ${response.status}`);
  }
  return response.text();
};
