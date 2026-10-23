# Commits, the changelog and Findings

PRs are squash-merged, so a PR's title becomes the commit on `main`. CI checks every PR title, requires a changelog fragment for the changes a player would want to hear about, and requires a Finding for analysis of the original game. A `commit-msg` hook checks local commits' format, and a `pre-commit` hook lints staged TypeScript and checks staged Findings; `bun install` turns both on.

A PR stacked on another PR's branch conflicts once its base is squash-merged. Rebase it onto `main` straight away: `git rebase --onto origin/main <old-base-branch>`, then retarget the PR with `gh pr edit --base main`. To wait for CI, use `gh pr checks --watch`.

## Subject format

```text
type(scope)!: Sentence-case imperative description (#issue)
```

- **type**, one of:
  - `feat`: a new or changed behaviour a player would notice.
  - `fix`: a behaviour that was wrong.
  - `perf`: the same behaviour, faster or smaller.
  - `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`: no change a player would notice. Analysis of the original game is `docs(re)`.

  Pick the type from what the diff does, not from the branch name or the issue's wording: a `fix/issue-141` branch that adds a behaviour the port never had is `feat`.

- **scope**, optional, one of:
  - `sim`: the headless simulation, `web/src/sim/`.
  - `view`: rendering, UI and the tick driver, `web/src/view/`.
  - `tools`: the asset pipeline and repo tooling, `tools/`.
  - `re`: analysis of the original game: Findings and `docs/re/`.
  - `spec`: Specs in `docs/spec/`.
  - `docs`: other documentation, the glossary and ADRs.
  - `repo`: CI, hooks and workspace setup.
- **!**, before the colon, marks a breaking change. A `BREAKING CHANGE: ...` line in the PR body does too.
- The description starts with a capital letter and doesn't end with a full stop. It may end with the issue it closes, as `(#10)`, or the ADR it records, as `(ADR 0004)`.

Examples:

```text
feat(sim): Move Forces to their destination at the original's pace (#10)
fix(view): Keep the Campaign Level scrolling at the map's edge (#8)
docs(re): Record the starting Unit table layout (#5)
ci(repo): Enforce Conventional Commit titles and changelog fragments
```

The hook lets through `fixup!`, `squash!` and `amend!` commits, and the merge and revert commits git writes itself.

## When a changelog fragment is needed

A PR whose title is `feat`, `fix` or `perf`, or marks a breaking change, adds a fragment under `changelog/unreleased/` whose type and scope match the title. [The fragment format](../../changelog/README.md) describes the file. There is no way to skip this: a change with nothing worth recording has the wrong type, so retitle it.

## When a Finding is needed

A PR scoped `re` adds or changes at least one Finding under `docs/findings/`. Any other PR that learns how the original game worked should add one too, though CI can't tell. [The Finding format](../findings/README.md) describes the file.

## Releasing

Versions are `0.x.y`: each roadmap milestone (#2) is a minor version, with patch versions for fixes in between, and `1.0.0` is the whole game playable. To release:

1. With the assets exported (`bun run extract-all`), run `bun test tools/strategy.test.ts web/src/view/demo-mode.test.ts`. CI has no assets, so it cannot replay the Demos (docs/spec/demo-mode.md); a failure means a change has broken one.
2. On a branch, run `bun run changelog:release 0.1.0`. It writes `releases/changelog/0.1.0.md`, updates the index, deletes the fragments and bumps `package.json`.
3. Merge it as `chore(repo): Release 0.1.0`.
4. Tag the merge commit on `main`: `git tag v0.1.0 && git push origin v0.1.0`.

## Checking locally

`bun run check` runs every check CI runs (the `check` script in `package.json`). To check a PR the way CI does, run:

```sh
PR_TITLE="feat(sim): Add x" BASE_REF=main bun tools/commits/check.ts pr
```
