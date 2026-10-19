# Domain docs

## Layout and reading rules

This repository uses a single-context layout.

Before exploring the codebase, read root `GLOSSARY.md` if present and
the ADRs in `docs/adr/` relevant to the area being explored.

If these documents do not exist, proceed silently. Domain modeling
creates them lazily as terminology and decisions are resolved.

## Vocabulary

Use glossary terms when naming domain concepts in issues, proposals,
code, and tests. Respect synonyms the glossary explicitly avoids.

If a needed term is missing, reconsider whether it belongs to the domain;
record real terminology gaps for domain modeling.

## Architectural decisions

Explicitly flag proposals that contradict an existing ADR, citing the
decision and explaining why it should be reconsidered.
