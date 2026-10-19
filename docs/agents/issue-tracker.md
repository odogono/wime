# Issue tracker: GitHub

Issues and specs live in GitHub Issues for `odogono/wime`.
Use the `gh` CLI from this checkout; pass `--repo odogono/wime`
when running elsewhere.

## Operations

- Publish an issue or spec: `gh issue create --title "..." --body-file <file>`.
  Write multiline bodies to a temporary file, preserving newlines.
- Fetch a ticket: `gh issue view <number> --json number,title,body,labels,comments`.
- List tickets: `gh issue list --state open --json number,title,body,labels`.
  Filter by label or state as needed.
- Comment: `gh issue comment <number> --body-file <file>`.
- Apply or remove labels: `gh issue edit <number> --add-label "..."` or
  `--remove-label "..."`. Read `triage-labels.md` for triage role mappings.
- Close: `gh issue close <number> --comment "..."`.

## Related work

Use GitHub sub-issues to connect child tickets to a parent when supported.
Otherwise, add `Part of #<parent>` to each child and a task list to the parent.

Use native GitHub issue dependencies when available. Otherwise, record
`Blocked by: #<number>` near the top of the issue body and treat it as
blocked until every referenced issue is closed.

## Pull requests as a triage surface

PRs as a request surface: no.
