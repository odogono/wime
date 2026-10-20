---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - tool:tools/extract-graphics.ts#decodeFrmlResource
  - resource:BScene.res#FRML 18
  - resource:BScene.res#FRML 19
issue: 80
---

**Bit 0 of a resource's attribute byte in the resource map is set when the resource is packed with PackBits.**
Every packed resource in the six resource files (finding:data-formats-resource-files-and-sizes) has the bit set, and every one stored plain has it clear: two IMAG resources and BScene.res FRML 18 and 19. A plain IMAG can also be told by its leading `0x0200` (finding:data-formats-imag-bitmaps), but a plain FRML starts with no such mark, so the attribute is the only way to tell. Packed resources begin with their unpacked size (finding:data-formats-packbits-compression).
