# Grounded assistant — planned 14 / GitHub #15

## Selected target — 2026-10-04

Not implemented or verified yet. Current hosted baseline is planned tickets
01–13. Native/iOS and its progress tracker remain untouched.

A completed saved note gains a live English study assistant beneath its content.
Current note always participates. Ask this topic and Ask my library are independent
textbox toggles, including both together. A topic selector uses this note's
confirmed topics. Topic evidence takes precedence over wider library relevance;
source identities are deduplicated. Exact citations open the existing evidence
panel while preserving the anchor note and conversation.

Use Postgres full-text retrieval over owned completed current source notes,
current note plus up to four topic and four relevant library sources. Topic
corrections apply through the current maps. Each request has a bounded serialized
model context (30,000 characters), original saved passages and bounded output.
The backend checks source versions/note revisions and topic membership again
after the model call. Changed/deleted evidence returns an actionable retry,
not an answer using stale material. Provider calls use existing server-only
configuration and strict structured responses. Source text/previous messages
are untrusted content. No outside facts, browsing or research links are allowed.

The conversation is local to the current component/tab, with bounded recent
messages if needed for follow-ups; durable chat history is outside this slice.
Changing note/version or reloading starts a fresh conversation. Unsupported
questions explain the evidence gap and offer Find reliable sources, opening the
existing clearly labelled reading-list preview. Live discovery remains planned
15; existing example assistant remains labelled preview. Notes are read-only.

## Agreed checks

Authenticated question/scope API; model HTTP responses; database
ownership/retrieval and source-version checks; browser scope/citation/unsupported
answer flows. Follow RED→GREEN at these boundaries, full checks at closeout,
and independent standards/spec review. Reviewed reversible migration and hosted
API/model/browser acceptance remain pending.
