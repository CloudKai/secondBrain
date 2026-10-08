# Topic learning journey — design interview

Status: **interview synthesized into a target specification**, 2026-10-09.
The user requested `to-spec`; the [specification](topic-learning-journey-spec.md)
is published as [GitHub #28](https://github.com/CloudKai/secondBrain/issues/28),
labelled `ready-for-agent`. No application implementation or acceptance is claimed.
This document retains the `grill-with-docs` decision record.

## Verified starting point

The web app captures articles, selectable-text PDFs and transcripts; persists
source notes, cited topic assignments and combined overviews; and offers source
discovery with explicit saving. Sources retain inspectable passage/page/time
references. Topic relationships represent saved-material coverage, not mastery.

Recall currently reveals an answer and records a session-only self-report.
Assistant conversation is temporary and current answers present attributed
source excerpts. There is no durable learner goal, learner-answer assessment,
adaptive lesson sequence or review schedule. See `scope.md` and the web tracker
for verified acceptance and remaining AI quality limits.

## Confirmed target decisions

### Q1 — Topic collections

Topic collections become the main learning home. Individual source notes remain
available, and one source is enough to start a collection. Learners can discover
sources within the app by topic and save material they find elsewhere. As new
material is added, the graph expands so learners can revisit the broader
structure of their learning.

The graph must distinguish saved coverage from learner progress, as confirmed
in Q6. Q12 confirms a learning path/concept map can begin with one source.
Suggested learning order is distinct from source-supported relationships;
this does not establish additional independent-source evidence for the existing
library graph.

### Q2 — Editable learning goals

Suggest a goal from saved material and allow the learner to confirm or change
it. Goals can change over time. Do not silently replace the goal when a source
is added. Q9 confirms a goal change can branch from the existing path; Q10
confirms relevant prior learning can be shared without implying new practical
requirements are already completed.

### Q3 — Optional background teaching

Offer prerequisite teaching with greater transparency about its support and
relationship to saved sources. Present an overview before the learner confirms
and opens it. This preview/confirmation interaction is the requested "unlock"
experience. Q8 permits free exploration; Q12 uses confirmation to open suggested
paths, without establishing a prerequisite-completion requirement.

### Q4 — Guided teaching with a tutor

Learning sessions use short explanations, worked examples, learner answers and
feedback, with a tutor available throughout. Reading a revealed answer alone
does not count as passing a practice check. Q8 confirms free exploration and
learner-controlled difficulty. Exercise types and adaptation rules remain open.

### Q5 — Confirmed source-driven replanning

When a new source is added, preview its contribution: new concepts, examples,
disagreements and prerequisites. Propose a revised learning plan and apply
lesson-order changes after learner confirmation. Preserve previous attempts
and completed work. A source save and acceptance of a plan revision are distinct
actions. Source additions must not silently replace the learner's goal.

### Q6 — Activity and understanding checks

Show reading/practice activity separately from demonstrated understanding.
Learner explanations or application answers can receive feedback. Uncertain
checks remain inconclusive; one correct answer does not establish mastery of a
whole topic. Exact progress labels, repeat checks and review behavior remain open.

### Q7 — Several starting paths

For a broad topic, offer several possible starting paths and let the learner
choose where to venture. Avoid presenting one inferred intention as the only
route. How suggestions expose saved-source coverage and missing material remains
to be specified.

### Q8 — Free exploration and adjustable difficulty

Recommend an order and flag helpful prerequisites without restricting learners
to it. Learners may skip lessons, attempt practice first and explore advanced
concepts. They can change difficulty when teaching feels too easy or too hard.
Optional background teaching still uses preview, confirmation and opening.
Q11 requests a difficulty setting that retains previous-level progress.
Q13 confirms per-path settings, retained original-level results and adjustment
of upcoming teaching/practice.

### Q9 — Goal changes create branches

A changed goal can branch off the current path, rather than replacing it.
For example, “Understand RAG” can branch into “Build a RAG application.”
Preserve the original journey and learning history. Q10 confirms reuse of
relevant shared understanding while retaining new branch-specific requirements.

### Q10 — Shared learning across branches

Reuse relevant demonstrated understanding of shared concepts when branching,
while adding practical checks required by the new goal. Keep both paths and
learning history available. Shared understanding does not automatically complete
a new application exercise.

### Q11 — Difficulty setting with retained progress

The learner proposed a setting to change difficulty while preserving progress
at previous levels. The recommended mechanics are to retain attempts/results at
their original difficulty and adapt upcoming teaching and practice to the chosen
level. Q13 confirms per-path scope and retention of original-difficulty attempts.

### Q12 — Confirm to open suggested paths

One source can suggest a learning path and concept connections; related saved
sources expand the broader structure. List suggested paths, then let the learner
confirm a choice to unlock/open it. Distinguish suggested teaching order,
source-supported relationships and learning progress. Precise preview contents
are confirmed in Q14; behavior when coverage changes remains open.

### Q13 — Per-path difficulty

Set difficulty separately for each learning path and allow adjustment anytime.
Retain previous attempts/results at their original difficulty, adapting upcoming
explanations, examples and exercises to the selected level. Different paths may
have different levels; choosing a harder level does not complete its checks.

### Q14 — Transparent path preview

Before opening a path, preview learning outcomes, prerequisites, supporting
sources and areas needing additional material or generated background teaching.
The learner confirms through “Start this path.” Suggested sources remain
optional to save; confirming a path does not silently save external material.

### Q15 — Varied interactive practice

Mix short written explanations, application problems and quick questions,
depending on the topic and difficulty. Provide feedback and hints rather than
only revealing an answer. Exact exercise formats and answer-checking behavior
need specification; no executable code grader or specialist math checker has
been selected.

### Q16 — Feedback, hints and retries

For incomplete or incorrect answers, identify the specific gap using clear
criteria and supporting source evidence. Offer a hint and retry before revealing
a worked answer. If an answer cannot be reliably judged, show “Needs review”
rather than inventing a grade. Feedback remains separate from whole-topic mastery.

### Q17 — Durable progress and voluntary review

Persist progress, attempts, per-path difficulty and branches across reopening the
app. Provide “Review what I learned” inside the app; learners choose when to
practise. This does not request external notifications or a new account flow.

### Q18 — Changes to supporting evidence

When new evidence contradicts a lesson, or a supporting source changes/is deleted,
retain learning history and flag affected lessons/checks for review. Explain the
change, show differing perspectives while their evidence is available and propose
a revised plan. Prior completion does not imply understanding of revised material.
Deleted or obsolete evidence must not be presented as current supporting citations.

### Q19 — Application model routing and conversation preference

For the application, the learner proposes GPT-6 Luna first, with escalation to
GPT-6.1 Sol at medium reasoning when confidence is insufficient. Luna medium
remains the requested initial setting. For this Codex conversation, the learner
prefers Luna; no tool available in this session can directly switch the running
conversation model. No application model or runtime has changed.

**Recommended routing policy, awaiting confirmation:** use evidence availability
and evaluated output-quality signals, rather than a model's self-reported
confidence percentage. With adequate evidence but an inadequate Luna draft,
allow at most one Sol-medium escalation under time/cost limits. Validate the Sol
result against the same criteria. Missing source evidence triggers an evidence
gap or optional source discovery; a stronger model cannot supply absent source
support. Unresolved teaching/feedback stays inconclusive, with inspectable source
material where useful. Ownership/version failures and provider outages are not
reasons to override data fences or spend on a stronger model.

Routing quality, latency, escalation rate and total cost require representative
evaluation. No calibrated classifier is currently enabled; citation coordinates
and valid output structure alone do not establish semantic correctness.

Official references checked on 2026-10-09:
- [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [Reasoning effort](https://developers.openai.com/api/docs/guides/deployment-checklist#set-up-reasoningeffort)

### Q20 — First delivery unit

Deliver a complete one-source journey first: a topic collection, editable goal,
transparent path preview, guided lessons and practice, feedback and saved
learning progress. This is the agreed first implementation unit, not an
implemented capability. Later delivery adds multi-source plan revisions,
branching and broader graph learning indicators. Preserve the full agreed target
vision; first delivery must demonstrate actual teaching and learner interaction.

### Q21 — Model selection per request in application code

The learner selected application-level routing rather than a single global
`OPENAI_MODEL` setting for the new learning system. Keep a shared, versioned
model-routing policy in backend code and select the model/effort for each request.
Secrets such as `OPENAI_API_KEY` remain in the server environment. Existing legacy
configuration is not removed during this design interview.

Preserve the earlier targets: `gpt-6-luna` with medium reasoning initially,
`gpt-6.1-sol` with medium reasoning for the proposed bounded escalation. The
pasted sample's `gpt-6-sol` and Pro mode do not silently replace those choices.
Use Responses consistently for these routes; model selection does not itself
implement output validation, semantic-confidence calibration or escalation.
No provider request, application migration or runtime model change has occurred.

## Proposed delivery sequence

1. **One-source learning:** use an owned saved source to suggest teachable goals
   and paths; confirm a path; teach through explanation/example/attempt/feedback;
   retain difficulty-specific attempts and progress across reopening. Keep exact
   citations, transparent background previews and voluntary review of studied work.
2. **Collection growth:** integrate topic source discovery and new saved sources;
   preview their contribution and proposed plan changes; handle disagreements,
   changed/deleted support and retained historical progress.
3. **Branches and broader orientation:** retain goal-based branches, reuse relevant
   understanding, and show suggested learning order, evidence relationships and
   activity/check results with distinct meanings in the wider topic graph.

All phases are target work. The initial teaching and feedback implementation needs
quality acceptance beyond schema validation: source support, explanation and
example correctness, hint usefulness, feedback criteria, uncertainty handling,
appropriate challenge and preservation of prior work. Compare Luna-only,
Sol-only and routed results on the same reviewed cases using the existing
DeepEval evaluation direction. Measure latency and cost before selecting routing
thresholds and setting an explicit hosted cost ceiling. Preserve the earlier
10–15-second first-useful-verified-text goal as a measurement target, not a promise;
escalation may require extra time and must have a bounded timeout.

## Decision tree and next frontier

- Topic collection → teaching interaction, initial depth and topic scope.
- Editable goal → replanning when the goal or supporting sources change.
- Learning graph → progress evidence, historical view and coverage distinction.
- Background preview → provenance, discovery/save behavior and confirmation.

Routing location is settled. The user's `to-spec` request ends the product
interview and synthesizes existing decisions rather than starting another round.
The published specification identifies conservative routing defaults and measured
quality/cost gates separately from confirmed product decisions. Test boundaries
have been proposed through the skill-required check; confirmation is pending.
No application implementation has begun.

## Boundaries

This is a web design interview. Mobile/iOS and its progress tracker are untouched.
Preserve original sources, citation locations and learner topic corrections.
New target behavior requires a confirmed specification and implementation
acceptance; generated pedagogical quality is not established by citation validity.
