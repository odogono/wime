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

`artifacts/` exists only in the main checkout (the first line of `git worktree list`). In a worktree, the tools find it through `findArtifactsDir` in `tools/extract-graphics.ts`, but their output lands in the current checkout, so run the tool there rather than looking for output in the main checkout. Never copy these files, or anything extracted from them, into tracked paths. Tool output goes to gitignored dirs and is regenerated on demand:

- `bun run extract-manual`: the manual's text and page images, in `extracted_text/`
- `bun run disasm`: the executable's annotated disassembly, in `extracted_asm/` (see `docs/re/README.md`)
- `bun run extract-graphics` / `extract-text`: resources, in `extracted_graphics/` and `extracted_text/`

The extraction tools need `lha` and the poppler tools on PATH (`brew install lhasa poppler`).

## Tooling

Bun is the repo's runtime and package manager.

In this shell `cat` is aliased to `bat` and `ls` to `eza`, which reject some standard flags; use `command cat` and `command ls` in scripts and pipelines.

Run `bun install` once per checkout (it also turns on the git hooks), and `bun run check` before a PR.
