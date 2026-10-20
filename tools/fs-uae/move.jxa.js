ObjC.import('CoreGraphics');
function run(argv) {
  // move.js x0 y0 x1 y1 steps : post a series of mouse-moved events
  const [x0, y0, x1, y1, n] = argv.map(Number);
  for (let i = 0; i <= n; i++) {
    const p = $.CGPointMake(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
    const e = $.CGEventCreateMouseEvent(
      $(),
      $.kCGEventMouseMoved,
      p,
      $.kCGMouseButtonLeft
    );
    $.CGEventPost($.kCGHIDEventTap, e);
    delay(0.02);
  }
}
