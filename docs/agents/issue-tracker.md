# Issue tracker: GitHub

Issues and specs live in GitHub Issues for CloudKai/secondBrain.
Use the gh CLI from the repository root. All applications, including `mobile/`,
belong to this repository; explicitly target CloudKai/secondBrain with --repo.

## Operations

- Create: gh issue create --repo CloudKai/secondBrain --title "..." --body-file <file>
- Read: gh issue view <number> --repo CloudKai/secondBrain --comments
- List: gh issue list --repo CloudKai/secondBrain --state open --json number,title,body,labels,comments
- Comment: gh issue comment <number> --repo CloudKai/secondBrain --body-file <file>
- Label: gh issue edit <number> --repo CloudKai/secondBrain --add-label "..." or --remove-label "..."
- Close: gh issue close <number> --repo CloudKai/secondBrain --comment "..."

For multiline bodies, write the exact text to a temporary file and
pass --body-file.

“Publish to the issue tracker” means create a GitHub issue.
“Fetch the relevant ticket” means read the issue and its comments.

## Pull requests as a triage surface

PRs as a request surface: no.

A bare issue number can identify an issue or a pull request.
Resolve it with gh pr view first, then gh issue view.

## Wayfinding

- A map is an issue labelled wayfinder:map containing Notes,
  Decisions-so-far, and Fog.
- Child tickets use wayfinder:research, wayfinder:prototype,
  wayfinder:grilling, or wayfinder:task.
- Link children through GitHub sub-issues. If unavailable, use a
  task list in the map and “Part of #<map>” in each child.
- Use native issue dependencies through gh api, with numeric
  database IDs. If unavailable, record “Blocked by: #<number>”.
- The next ticket is the first open, unassigned child in map order
  whose blockers are closed.
- Claim by assigning the ticket to the driving developer.
- Resolve by commenting with the result, closing the ticket, and
  adding a summary and link to the map’s Decisions-so-far.
