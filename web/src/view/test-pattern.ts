import { NATIVE_HEIGHT, NATIVE_WIDTH } from "./screen";

// Amiga colours are 12-bit RGB, so every bar is a #rgb value.
const BARS = ["#fff", "#ff0", "#0ff", "#0f0", "#f0f", "#f00", "#00f", "#000"];

// A placeholder that makes scaling faults obvious: any blur or off-by-one
// shows up in the single-pixel border and checkerboard.
export const drawTestPattern = (
  ctx: CanvasRenderingContext2D,
  scale: number,
): void => {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

  const barWidth = NATIVE_WIDTH / BARS.length;
  BARS.forEach((colour, i) => {
    ctx.fillStyle = colour;
    ctx.fillRect(i * barWidth, 0, barWidth, 80);
  });

  ctx.fillStyle = "#fff";
  for (let y = 80; y < 160; y++) {
    for (let x = y % 2; x < NATIVE_WIDTH; x += 2) {
      ctx.fillRect(x, y, 1, 1);
    }
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 160, NATIVE_WIDTH, NATIVE_HEIGHT - 160);
  ctx.fillStyle = "#fff";
  ctx.font = "8px monospace";
  ctx.textBaseline = "top";
  ctx.fillText(
    `${NATIVE_WIDTH}x${NATIVE_HEIGHT} at ${scale}x`,
    4,
    NATIVE_HEIGHT - 20,
  );

  ctx.strokeStyle = "#f00";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, NATIVE_WIDTH - 1, NATIVE_HEIGHT - 1);
};
