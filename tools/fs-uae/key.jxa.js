ObjC.import('CoreGraphics');
function run(argv) {
  for (const k of argv) {
    const code = +k;
    const d = $.CGEventCreateKeyboardEvent($(), code, true);
    $.CGEventPost($.kCGHIDEventTap, d);
    delay(0.12);
    const u = $.CGEventCreateKeyboardEvent($(), code, false);
    $.CGEventPost($.kCGHIDEventTap, u);
    delay(0.12);
  }
}
