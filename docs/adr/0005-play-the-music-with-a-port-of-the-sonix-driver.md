# Play the music live with a port of the Sonix driver

The original plays its music with the Aegis Sonix Music Driver built into its code (finding:sound-game-carries-the-sonix-driver). The scores are notes, not recordings, and three kinds of instrument turn them into sound: a synthesiser that reshapes a 128-byte waveform as a note plays, recorded samples with one copy per octave, and IFF 8SVX samples. We considered three ways to play them in the browser:

- Rendering every piece to audio files in the tools, and playing those. The runtime would be trivial, but the assets would be several megabytes, and every piece would sound the same each time, where the original's synthesiser starts each note from its current state.
- Rendering in the tools with nuade's C player compiled at export time. That needs the least porting, but puts a C toolchain into every checkout's setup.
- Porting the driver to TypeScript and running it live in an AudioWorklet, on the exported scores and instruments.

We chose the third. The port is a headless module under `web/src/audio/` that renders samples into a buffer. It takes no DOM and no Web Audio types, so tests render pieces and check them without a browser. A thin AudioWorklet runs it in the browser, and the view tells it what to play and when (`docs/spec/audio.md`).

This is an exception to ADR-0001, which rejected transliterating the original's code. The Sonix driver is a third-party music engine, not the game's rules. It plays its file formats the way the bitmap decoders draw IMAG resources, and how it sounds depends on details only a faithful port keeps: its tempo and pitch tables, its envelopes and its note timing. The port follows nuade's `players/sonix` (MIT licence, Copyright the nuade authors), itself a port of the driver's 68000 code, and keeps that licence notice. Only the SMUS scores and the three instrument techniques the game uses are ported, not Sonix's other score formats. Everything the game decides about music, which piece plays and when, stays in the Spec and the view's own code.

Scores, instruments and samples are exported by `bun run export:web` as JSON into the gitignored assets: each score, instrument and sample file's bytes, base64-encoded. This relaxes, for audio alone, the rule that the browser never reads Amiga formats (ADR-0001, ADR-0003): it still loads only exported JSON, never the original files, but the port reads the Sonix structures inside it, because that is what the driver plays.
