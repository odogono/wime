# Coding standards

Read at review. Lint, Prettier and `tsc` enforce the mechanical rules (`bun run check`); these are the judgement calls they cannot.

- **Cite the source of original behaviour.** Code that reproduces how the original worked cites where that is known from, in a comment: `(finding:<slug>)`, `(manual, pdf-pN)` or `(docs/spec/<file>.md)`. A guess says so ("provisional", "not traced").
- **The sim stays headless and deterministic** (ADR-0002). `web/src/sim` imports nothing from `web/src/view` or the DOM, and draws randomness only from the seeded RNG. A view-only choice, such as a message wording, may use `Math.random`.
- **Use the glossary's terms** (`GLOSSARY.md`) in names, comments and messages: _Force_, _Leader_, _Campaign Level_, not their _Avoid_ synonyms.
- **The browser loads only exported assets** (ADR-0001, ADR-0003): PNG and JSON from `bun run export:web`, never Amiga formats parsed at run time.
- **Saves are versioned.** A change to what `serialiseSave` writes bumps `SAVE_VERSION`.
- **New behaviour comes with a test** in the sim when it is sim behaviour; the view is tested where it holds logic, such as hit-testing or timing.
