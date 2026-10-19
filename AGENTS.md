## Agent skills

### Issue tracker

Track issues and specs in GitHub Issues for `odogono/wime`.
Before reading, creating, or updating tickets, read `docs/agents/issue-tracker.md`.

### Commits and the changelog

PR titles follow Conventional Commits. `feat`, `fix`, `perf` and breaking changes add a changelog fragment under `changelog/unreleased/` instead of editing a changelog; releases are written to `releases/changelog/`. Before writing a PR title or releasing, read `docs/agents/commits.md`.

### Findings

Everything learned about how the original game worked is recorded as one Finding per file in `docs/findings/`, and Specs cite them as `finding:<slug>` (ADR-0004). Before recording a Finding, read `docs/findings/README.md`. Search the existing Findings (`rg -l <term> docs/findings`) before analysing something.

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

`artifacts/` exists only in the main checkout. In a worktree, the tools find it through `findArtifactsDir` in `tools/extract-graphics.ts`. Never copy these files, or anything extracted from them, into tracked paths. Tool output goes to gitignored dirs (`extracted_graphics/`, `extracted_text/`) and is regenerated on demand.

The extraction tools need `lha` on PATH (`brew install lhasa`).

## Tooling

Bun is the repo's runtime and package manager. Run `bun install` once per checkout (it also turns on the git hooks), and `bun run check` before a PR.
