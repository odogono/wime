---
kind: fact
topic: data-formats
confidence: provisional
sources:
  - tool:tools/extract-text.ts#decodeCstrPayload
  - resource:BScene.res#CSTR 56
---
**A few long story texts are "styled" CSTR resources with a 4-byte header and inline command bytes; the tool's decoding of them is a heuristic, not a known format.**
The tool treats a CSTR as styled when it starts with two zero bytes followed by a big-endian 16-bit value at least as large as the resource. It skips those 4 bytes, and one more if the next byte is `0x0B` or `0x5C`. Inside the text it reads `0xFF XX YY` as the printable character XX shown twice, with YY a control byte. Any other byte with the top bit set is taken as a style or position command: three bytes long if followed by `0x20` and a byte below `0x80`, otherwise one byte. These rules were inferred from how the decoded text reads, so the meaning of the command bytes is still open.
