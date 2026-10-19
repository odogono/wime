# Record knowledge of the original as append-only Findings

ADR-0001 had Specs tag each fact with its raw source (`disasm:0x…`, `manual`, …). That mixed two things: what the original game did, and what our simulation must do. It also meant that many PRs would edit the same few Spec files, causing merge conflicts. We separated them instead:

- Each fact about the original game, and each Lesson about the analysis, is its own small file in `docs/findings/` that carries its sources and confidence.
- Findings are never deleted. A new Finding `supersedes` one that later evidence overturns.
- Specs state what the reimplementation must do and cite Findings as `finding:<slug>`.
- A readable account of how the game worked, `bun run findings`, is built from the Findings and never committed.

This replaces only ADR-0001's provenance rule; specs-before-code still stands.

## Considered Options

- **Facts written straight into Specs**, as ADR-0001 first had it. This had no history of overturned beliefs, gave nothing to read for anyone not building the game, and caused conflicts in the shared Spec files.
- **Per-topic research files**, as `mercenary`'s `docs/research/` has them. These are readable, but parallel PRs conflict on the same file, and a fact has no ID a Spec can cite.
