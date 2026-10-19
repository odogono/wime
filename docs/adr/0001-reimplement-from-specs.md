# Reimplement the game from written specs

The goal is a faithful browser version of War in Middle Earth. We rejected two alternatives. Running the original binary in an in-browser Amiga emulator was rejected because it would only wrap the original and leave no room for later remake layers. Transliterating the 68k code was rejected because the result would be unreadable and would inherit the original's structure. Instead, behaviour is recovered from the original instruction manual (`artifacts/WarinMiddleEarth-InstructionManual.pdf`), from play observed in an emulator, from resource data and from disassembly. It is written up in `docs/spec/`, and every fact is tagged with its source (`manual`, `observed`, `resource:…`, `disasm:0x…`). The TypeScript code is written from those specs and cites spec sections, not disassembly addresses.

ADR-0004 amends this: facts and their sources now live in Findings, which Specs cite.
