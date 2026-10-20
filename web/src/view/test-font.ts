// A made-up font for the view's tests: every glyph advances 4 pixels,
// so layout logic is tested without the original's assets. Tests of the
// real lettering read lord/10's exported metrics (font.test.ts).
import type { Font, FontMetrics } from './font';

export const FIXED_FONT: FontMetrics = {
  baseline: 7,
  glyphs: Array.from({ length: 96 }, (_, i) => ({
    code: i < 95 ? 32 + i : null,
    kern: 0,
    space: 4,
    width: 3,
    x: i * 4
  })),
  height: 10,
  hiChar: 126,
  loChar: 32
};

export const fixedFont = (): Font => ({
  metrics: FIXED_FONT,
  sheet: { height: 10, width: 384 } as unknown as CanvasImageSource
});
