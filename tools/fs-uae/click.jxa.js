ObjC.import('CoreGraphics');
function run(argv) {
  const x = +argv[0],
    y = +argv[1];
  const p = $.CGPointMake(x, y);
  const post = t => {
    const e = $.CGEventCreateMouseEvent($(), t, p, $.kCGMouseButtonLeft);
    $.CGEventPost($.kCGHIDEventTap, e);
  };
  post($.kCGEventMouseMoved);
  delay(0.1);
  post($.kCGEventLeftMouseDown);
  delay(0.15);
  post($.kCGEventLeftMouseUp);
}
