## Agent skills

### Issue tracker

Track issues and specs in GitHub Issues for `odogono/wime`.
Before reading, creating, or updating tickets, read `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical triage labels.
Before assigning triage state, read `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout: root `GLOSSARY.md` and `docs/adr/`.
Before exploring domain concepts or architectural decisions, read `docs/agents/domain.md`.

## Original game files

The original game files live in `artifacts/`, which is gitignored and never committed:

- `amiga/WarInMiddleEarth_v1.0_0968.lha`: the canonical reference (ADR-0003)
- `apple/`: Apple IIgs disk images (`.2mg`, `.po`), a secondary reference
- `WarinMiddleEarth-InstructionManual.pdf`: the original manual, the source cited as `manual` in specs

`artifacts/` exists only in the main checkout. In a worktree, the tools find it through `ARTIFACTS_DIR` in `tools/extract_graphics.py`. Never copy these files, or anything extracted from them, into tracked paths.

The Python tools need `lha` on PATH (`brew install lha`) and Pillow.
