---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - tool:tools/extract_graphics.py#parse_resource_fork
---
**Each `.res` file is a resource fork in the classic Macintosh layout: a 16-byte header, a data area, and a resource map that lists resources by four-character type and 16-bit ID.**
All numbers are big-endian. The header holds four 32-bit values: data area offset, map offset, data area length and map length. In the map, the 16-bit value at map offset +24 is the offset of the type list and the one at +26 is the offset of the name list, both counted from the start of the map.

The type list starts with a 16-bit count minus one. Each 8-byte type entry is the 4-character type code (Latin-1), a 16-bit resource count minus one, and a 16-bit offset to that type's reference list, counted from the start of the type list. Each 12-byte reference is a signed 16-bit ID, a signed 16-bit name offset into the name list (-1 for no name), one attribute byte, and a 24-bit offset into the data area; the last four bytes are not used. At that data offset sits a 32-bit length followed by the resource's bytes. Names are Pascal strings: a length byte then the text.
