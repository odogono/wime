# The Amiga v1.0 release is the canonical reference

War in Middle Earth shipped for DOS (up to VGA), Apple IIgs, Amiga, Atari ST and others, and the versions differ in graphics and behaviour. The reference is the Amiga v1.0 WHDLoad release (`artifacts/amiga/WarInMiddleEarth_v1.0_0968.lha`), for four reasons:

- The extraction tools already handle it.
- Its executable has readable initialised data tables.
- 68k is far easier to disassemble than the 65816 or x86.
- Ghidra and vAmiga both support it well.

Where the Amiga build can't settle a question, other versions may be consulted, but they are never authoritative. The Apple IIgs disks (`artifacts/apple/`) are the main secondary reference; the Amiga resource-fork format probably comes from the IIgs version. The 256-colour DOS and IIgs graphics are a possible source for a later remake layer only.

The game is for personal, private use, so the extracted assets may be bundled into the web build. The original files in `artifacts/` and anything extracted from them stay out of git.
