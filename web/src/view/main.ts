import { createScreen } from "./screen";
import { drawTestPattern } from "./test-pattern";

const canvas = document.querySelector<HTMLCanvasElement>("#screen");
if (!canvas) {
  throw new Error("No #screen canvas");
}
const screen = createScreen(canvas);

const redraw = (): void => {
  const { scale } = screen.resize();
  drawTestPattern(screen.buffer, scale);
  screen.present();
};

window.addEventListener("resize", redraw);
redraw();
