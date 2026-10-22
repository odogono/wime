// press.jxa.js X Y: a left click at host point X, Y with no move event
// first, so the relative Amiga pointer stays where aim.sh put it.
ObjC.import('CoreGraphics');
function run(argv) {
  const p = $.CGPointMake(+argv[0], +argv[1]);
  for (const t of [$.kCGEventLeftMouseDown, $.kCGEventLeftMouseUp]) {
    const e = $.CGEventCreateMouseEvent($(), t, p, $.kCGMouseButtonLeft);
    $.CGEventPost($.kCGHIDEventTap, e);
    delay(0.15);
  }
}
