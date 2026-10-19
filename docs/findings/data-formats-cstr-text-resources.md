---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - tool:tools/extract-text.ts#decodeCstrPayload
  - resource:AText.res#CSTR 57
  - resource:BScene.res#CSTR 56
---
**In-game text is stored in CSTR resources, most of them plain zero-terminated Latin-1 strings with carriage returns for line breaks.**
There are 4 CSTR resources in AText.res and 57 in BScene.res. AText.res CSTR 57 holds the Ring verse ("Three Rings for the Elven-kings…"). BScene.res CSTR 56 is a styled story text that mentions Rivendell and includes the line "I will return as soon as I can". The tool converts carriage returns (alone or followed by a line feed) to line feeds and silently drops control bytes 1 to 8, 11, 12 and 14 to 16.
