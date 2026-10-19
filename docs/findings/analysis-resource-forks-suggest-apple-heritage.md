---
kind: lesson
topic: analysis
confidence: provisional
sources:
  - tool:tools/extract_graphics.py#parse_resource_fork
  - tool:tools/extract_graphics.py#unpack_packbits
---
**The Amiga build keeps its data in Apple-style resource forks inside its `.res` files, which suggests it was ported from an Apple version, most likely the Apple IIgs one.**
Resource forks, four-character types such as IMAG and CSTR, and PackBits compression are all Apple conventions, not Amiga ones; an Amiga program would normally use IFF files. Their presence suggests the Amiga code was ported with the Apple data loaders kept. One caution: the layout the tool parses is the big-endian classic Macintosh resource fork, whereas the IIgs's own Resource Manager format is little-endian and laid out differently. So the IIgs link has to be checked against the IIgs disk images before the IIgs data can be used as a cross-reference.
