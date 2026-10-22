# Findings

What we know about how the original War in Middle Earth worked, one Finding per file. A Finding is a single fact about the original game; a Lesson is a Finding about how the analysis went. Together they become a document others can read: `bun run findings` builds it into `build/findings.md` (gitignored).

Findings are never deleted. When new evidence overturns one, a new Finding `supersedes` it, and the document keeps the old one in its closing "Superseded findings" chapter. Specs in `docs/spec/` cite Findings as `finding:<slug>` instead of repeating their sources (ADR-0004).

## The file

`docs/findings/<slug>.md`, where the slug is the Finding's permanent ID. Start it with the topic, such as `movement-hobbit-pace.md`. Never rename a Finding once merged, since Specs cite it. Name the slug and the text with the terms in [`GLOSSARY.md`](../../GLOSSARY.md); if a concept has no term yet, add it to the glossary first, since renaming later means rewriting every Finding that uses it.

```md
---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:code+0x01a2c4
  - observed:hobbiton-to-bree
issue: 10
supersedes: movement-hobbit-pace-guess
---

**Hobbits travel at half a Wizard's pace on open ground.** The rate table at
code+0x01a2c4 gives ...
```

- `kind`: `fact`, or `lesson` for something learned about doing the analysis. A Lesson's topic is `analysis`.
- `topic`: the chapter it goes in: `map`, `places`, `forces`, `movement`, `time`, `combat`, `ai`, `objects`, `mobilisation`, `ui`, `graphics`, `sound`, `data-formats`, `executable` or `analysis`.
- `confidence`, from least to most certain:
  - `provisional`: an inference or a guess.
  - `documented`: the manual says so.
  - `observed`: seen in play.
  - `confirmed`: shown in the code or data.
- `sources`: one or more, as `kind:reference`:
  - `manual:pdf-p11`: a page of `artifacts/WarinMiddleEarth-InstructionManual.pdf`. `bun run extract-manual` writes its text, marked by page, and page images to `extracted_text/`.
  - `observed:<run>`: a Reference run played in FS-UAE ([docs/re/fs-uae.md](../re/fs-uae.md)).
  - `resource:<file>#<type> <id>`: a resource in the Reference Build.
  - `disasm:code+0x<offset>` or `disasm:data+0x<offset>`: an offset into the code or data hunk of the Reference Build's executable ([docs/re](../re/README.md) explains the layout).
  - `strings:0x<offset>`: an offset in the executable's string scan.
  - `tool:<path>#<function>`: code in `tools/` that decodes it.
  - `iigs:<reference>`: the Apple IIgs version.
- `issue`: optional, the issue the Finding came from.
- `supersedes`: optional, the slug of the Finding this one overturns.

The text opens with a bold headline sentence stating the fact, then explains it and its evidence for a reader who doesn't know the code. Paraphrase the manual; don't paste it.

## Topic intros

`topics/introduction.md` opens the document, and `topics/<topic>.md` opens each chapter. Each is a short hand-written passage that gives the chapter's Findings their context; edit them as the chapters grow.

## Checks

`bun run findings:check`, part of `bun run check`, validates every Finding, every `supersedes`, and every `finding:<slug>` cited in `docs/spec/`. Where `bun run disasm` has run, it also requires each routine a `disasm:code+0x…` source sits in to be named in [`docs/re/labels.md`](../re/labels.md), apart from the backlog in `tools/findings/unlabelled-routines.txt`. The pre-commit hook runs it whenever a commit touches `docs/findings/`. CI requires a PR scoped `re` to add or change a Finding ([commit conventions](../agents/commits.md)).
