import { describe, expect, test } from 'bun:test';

import { createDoubleTap } from './double-tap';

const pointer = (timeStamp: number, changes: Partial<PointerEvent> = {}) => ({
  button: 0,
  clientX: 100,
  clientY: 100,
  isPrimary: true,
  pointerId: 1,
  pointerType: 'touch',
  timeStamp,
  ...changes
});

describe('map double taps', () => {
  test.each(['mouse', 'touch', 'pen'])(
    'two nearby %s taps activate once, on release',
    pointerType => {
      const taps = createDoubleTap();
      const tap = (at: number, clientX: number) => {
        taps.begin(pointer(at, { clientX, pointerType }), 'full-map');
        return taps.end(pointer(at + 40, { clientX, pointerType }), 'full-map');
      };
      expect(tap(0, 100)).toBe(false);
      expect(tap(200, 110)).toBe(true);
      expect(tap(300, 110)).toBe(false);
    }
  );

  test('separate taps stay separate in time and space', () => {
    const taps = createDoubleTap();
    for (const [at, x] of [
      [0, 100],
      [500, 100],
      [600, 150]
    ] as const) {
      taps.begin(pointer(at, { clientX: x }), 'campaign');
      expect(taps.end(pointer(at + 30, { clientX: x }), 'campaign')).toBe(
        false
      );
    }
  });

  test('touches may have different pointer IDs', () => {
    const taps = createDoubleTap();
    taps.begin(pointer(0), 'campaign');
    taps.end(pointer(30), 'campaign');
    taps.begin(pointer(100, { pointerId: 2 }), 'campaign');
    expect(taps.end(pointer(130, { pointerId: 2 }), 'campaign')).toBe(true);
  });

  test.each(['campaign:10:20', 'animation', null])(
    'a changed context (%s) breaks the pair',
    context => {
      const taps = createDoubleTap();
      taps.begin(pointer(0), 'campaign:0:0');
      taps.end(pointer(30), 'campaign:0:0');
      taps.begin(pointer(100), context);
      expect(taps.end(pointer(130), context)).toBe(false);
    }
  );

  test('a camera or Level change while pressed invalidates the tap', () => {
    const taps = createDoubleTap();
    taps.begin(pointer(0), 'full-map');
    expect(taps.end(pointer(30), 'campaign')).toBe(false);
    taps.begin(pointer(100), 'campaign');
    expect(taps.end(pointer(130), 'campaign')).toBe(false);
  });

  test.each(['drag', 'hold', 'cancel', 'control', 'secondary', 'multitouch'])(
    '%s breaks a pending pair',
    kind => {
      const taps = createDoubleTap();
      taps.begin(pointer(0), 'campaign');
      taps.end(pointer(30), 'campaign');
      taps.begin(pointer(100), 'campaign');
      if (kind === 'drag') {
        taps.move(pointer(110, { clientX: 150 }));
        taps.move(pointer(120));
      } else if (kind === 'cancel') {
        taps.cancel();
      } else if (kind === 'control') {
        taps.begin(pointer(110), null);
      } else if (kind === 'secondary') {
        taps.begin(pointer(110, { button: 2 }), 'campaign');
      } else if (kind === 'multitouch') {
        taps.begin(
          pointer(110, { isPrimary: false, pointerId: 2 }),
          'campaign'
        );
      }
      expect(taps.end(pointer(kind === 'hold' ? 500 : 130), 'campaign')).toBe(
        false
      );
      taps.begin(pointer(550), 'campaign');
      expect(taps.end(pointer(580), 'campaign')).toBe(false);
    }
  );

  test('release movement is checked even without a move event', () => {
    const taps = createDoubleTap();
    taps.begin(pointer(0), 'campaign');
    expect(taps.end(pointer(30, { clientY: 150 }), 'campaign')).toBe(false);
    taps.begin(pointer(100), 'campaign');
    expect(taps.end(pointer(130), 'campaign')).toBe(false);
  });

  test('switching input devices does not pair taps', () => {
    const taps = createDoubleTap();
    taps.begin(pointer(0), 'campaign');
    taps.end(pointer(30), 'campaign');
    taps.begin(pointer(100, { pointerType: 'mouse' }), 'campaign');
    expect(taps.end(pointer(130, { pointerType: 'mouse' }), 'campaign')).toBe(
      false
    );
  });
});
