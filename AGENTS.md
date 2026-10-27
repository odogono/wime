## Code map

- `web/src/sim`: the headless, deterministic simulation (ADR-0002)
- `web/src/view`: rendering and input; in `main.ts`, the comment above `run` (search `run holds`) maps its sections
- `tools/`: extractors, the disassembler and repo checks
- `docs/spec/`: what the port does; `docs/re/`: reverse-engineering notes

Run the app with `bun run dev`. Before driving it in the preview, screenshotting it or attaching screenshots to a PR, read `docs/agents/port-preview.md`. Reviews apply `CODING_STANDARDS.md`.

## Agent skills

### Issue tracker

Track issues and specs in GitHub Issues for `odogono/wime`.
Read a ticket with `gh issue view <n> --json number,title,body,labels,comments` (plain `--comments` prints nothing here). Before creating or updating tickets, read `docs/agents/issue-tracker.md`.

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

`artifacts/` exists only in the main checkout (the first line of `git worktree list`). In a worktree, the tools find it through `findArtifactsDir` in `tools/extract-graphics.ts`, but their output lands in the current checkout, so run the tool there rather than looking for output in the main checkout. Never copy these files, or anything extracted from them, into tracked paths. Tool output goes to gitignored dirs and is regenerated on demand. In a fresh checkout, run `bun run extract-all`: it runs each tool below whose output is missing (`--force` reruns all).

- `bun run disasm`: the annotated disassembly, in `extracted_asm/`; read it with `bun run asm <address|label> [lines]`, `--routine` for the routine holding an address and `--refs` for its callers or a data address's users (`docs/re/README.md`)
- `bun run extract-manual`: the manual's text and page images, in `extracted_text/`
- `bun run extract-graphics` / `extract-text`: resources, in `extracted_graphics/` and `extracted_text/`
- `bun run export:web`: the assets the app loads, in `web/public/assets/`. Tests that read the original's data skip without them, as in CI, so export before trusting a green run.

To boot the original game in FS-UAE, read `docs/re/fs-uae.md`.

The extraction tools need `lha` and the poppler tools on PATH (`brew install lhasa poppler`). `bun run trace-emblem`, which makes Atlas emblems (docs/spec/atlas-emblems.md), needs ImageMagick and potrace (`brew install imagemagick potrace`).

## Tooling

Bun is the repo's runtime and package manager.

In this shell `cat` is aliased to `bat` and `ls` to `eza`, which reject some standard flags; use `command cat` and `command ls` in scripts and pipelines. Filter searches by file type with `rg -g '*.ts'`: a hook rejects unquoted globs such as `grep --include=*.ts`.

A new T3 worktree runs `bun install && bun run extract-all`; in any other fresh checkout, run them yourself (`bun install` also turns on the git hooks). Run `bun run check` before a PR.
