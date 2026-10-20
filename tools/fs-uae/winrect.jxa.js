ObjC.import('CoreGraphics');
const l = ObjC.deepUnwrap(
  ObjC.castRefToObject(
    $.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly, 0)
  )
);
const w = l
  .filter(x => /fs-uae/i.test(x.kCGWindowOwnerName || ''))
  .map(x => ({ b: x.kCGWindowBounds, id: x.kCGWindowNumber }));
JSON.stringify(w);
