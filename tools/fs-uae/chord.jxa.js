ObjC.import('CoreGraphics');
function run(argv) {
  const ev = (c, d) => {
    const e = $.CGEventCreateKeyboardEvent($(), +c, d);
    $.CGEventPost($.kCGHIDEventTap, e);
    delay(0.1);
  };
  for (const c of argv) ev(c, true);
  for (const c of [...argv].reverse()) ev(c, false);
}
