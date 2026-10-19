---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - tool:tools/extract_graphics.py#decode_imag_resource
  - resource:AMaps.res#IMAG 100
  - resource:ATitle.res#IMAG 70
---
**An IMAG resource is a planar bitmap with a 28-byte header, stored either raw or PackBits-compressed, with the bit planes interleaved row by row.**
If the resource starts with the 16-bit value `0x0200` it is uncompressed. Otherwise its first four bytes are the unpacked size and PackBits data follows, which must unpack to something starting with `0x0200`. In the unpacked header, byte 5 is the depth (number of bit planes, 1 to 8), and the big-endian 16-bit values at offsets 20 and 22 are the width and height in pixels. The other header bytes are not yet understood.

Pixel data starts at offset 28. Each plane row is padded to a whole number of 16-bit words, so a row is `ceil(width / 16) * 2` bytes. For each scanline, the row for plane 0 comes first, then plane 1, and so on. The leftmost pixel is the top bit of each byte, and plane 0 is the lowest bit of the colour index. For example, AMaps.res IMAG 100 is 80 by 96 pixels in 4 planes and unpacks to 3,868 bytes (28 + 10 × 96 × 4). ATitle.res IMAG 70 is 119 by 141 pixels in 5 planes (32 colours).
