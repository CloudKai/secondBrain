# GitHub #10 review — planned ticket 09

Fixed point: `b15c6c4`. Implementation: `4d33f0b`; review fixes: `7074ca6`, `ecf844a` and `26b0f6f`.
Diff: `git diff b15c6c4...26b0f6f`.
Spec: [GitHub #10](https://github.com/CloudKai/secondBrain/issues/10).
Independent agents reviewed Standards and Spec separately; neither changed code
or ran tests. Unrelated native/v1 working changes were excluded.

## Standards

No remaining material findings. The optional duplicated ownership validation in
TopicStore.list_owned was resolved by checking the list shape and reusing record.
The graph focus control uses existing design tokens and typed IDs. Placement
errors remain visible in topic details. The revised test title matches its
checks. Ownership, leases, evidence validation and native/v1 boundaries remain
intact. Summary: 0 hard findings; 0 remaining optional findings.

## Spec

Three initial findings were resolved: libraries above six topics retain a
connected focus view with every topic selectable; browser history derives the
saved/example graph from the active note; placement errors and reload controls
appear in note topic panels as well as the Topics page. No remaining material
findings. Combined synthesis and broad corrections remain deferred.

## Final incremental reviews

Standards: ecf844a scopes UUID string parsing to placement request fields while
retaining UUID validation, strict other schemas and ownership checks. The HTTP
regression covers valid/invalid input, authentication, cross-owner denial and
ownership exclusion. The copy-only 26b0f6f accurately states shared coverage and
the six-topic display limit. No hard or optional findings.

Spec: valid JSON placement confirmation now works without relaxing other
contracts. Shared-topic coverage does not imply a directional relationship;
lines remain reserved for supported uses/requires/evaluates relationships.
No scope creep or remaining findings. Final incremental reviews were read-only.

## Completed checks

113 backend tests through project Python, 34 web tests, build/typecheck and lint
pass. The stale bare pytest launcher remains an environment limitation. Hosted
migration succeeded after user approval; worker backfill, first-source cards,
real-model alias reuse and unrelated material passed. Hosted placement choices
persisted while notes remained unchanged; another learner was denied API/RLS/
worker RPC access. Browser checks passed exact excerpts, reload, example/saved
history and a seven-topic focus view. The explained relation display used a
controlled supported relation; mention handling and extraction also have model
HTTP checks. Six temporary sources and their study/topic/outbox rows were removed;
the original Neural networks capture/note/map remain. Desktop checks only.

Summary: Standards — 0 remaining findings. Spec — 0 remaining findings.
