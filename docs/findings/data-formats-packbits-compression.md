---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - tool:tools/extract_graphics.py#unpack_packbits
  - tool:tools/extract_graphics.py#decode_imag_resource
  - tool:tools/render_campaign_map.py#load_campaign_map_assets
---
**Compressed resources use PackBits run-length encoding, preceded by a big-endian 32-bit unpacked size.**
Each control byte n says what follows. For n from 0 to 127, copy the next n+1 bytes as they are. For n from 129 to 255, repeat the next byte 257-n times. The value 128 does nothing. Decoding stops once the unpacked size is reached. This is the same scheme as Apple's PackBits. Compressed IMAG, CHAR and MMAP resources all use it.
