# Retained goal branches and learning maps — development acceptance

Date: 2026-10-09. GitHub #28 remains open for full acceptance. This third unit
extends 39ea138; earlier captures, notes and mobile behavior are unchanged.

## Implemented

- Explicit changed goal → contribution/path preview → confirmed separate path,
  retaining the original goal and answers. Requires a distinct application question
  at model and database boundaries. Exact source manifests/citations are retained.
- Owned plan/lesson cursor restores the selected learning location. Navigation
  does not award reading activity or a passed check.
- Applicable prior reading/attempts appear as context only when ancestor outcome,
  difficulty and original supporting passages match exactly. Provisional feedback
  cannot establish shared mastery. New branch application checks remain separate.
- Teaching map from a first saved source: outcome/lesson order, freely navigable
  confirmed lessons and closed path previews requiring confirmation. Arrows are
  explicitly study guidance, separate from factual topic relationships.
- Topic graph panels describe collection activity across paths using its sources:
  saved paths, studied lessons, attempts and provisional checks. Evidence changes
  are flagged, and deleted anchors open authorized retained history. Original
  graph relationship/source thresholds remain unchanged.

## Automated checks and review

294 backend tests and 95 web tests pass, with typecheck/lint/build. Seven public
learning SQL cases and five rendered learning-view cases cover branch separation,
new application requirements, owner filtering, changed sources, removed collection
anchors, history retention, cursor selection, conservative context and graph labels.
Server/API tests cover strict request validation, JWT-owned place/graph reads and
Luna-medium generation with bounded repair. Exact evidence and JSON validation are
structural checks, not proof of teaching or grading correctness.
An isolated checkout of HEAD plus this staged unit also passes typecheck and all
82 web tests present in that commit; the workspace total of 95 includes other
ongoing web work.

Spec review caught reused exercises, lost branch resume position and unavailable
removed-anchor links. Standards review caught a support race before locking.
Regression checks cover all fixes; both review axes cleared remaining blockers.
Rollback locks before checking history and refuses used branches without export or
migration. It restores prior collection RPCs when branch history is unused.
Two existing backend deprecation warnings and the >500 kB web bundle warning remain.
The backend checks use backend/.venv/bin/python -m pytest backend/tests -q.

## Hosted/live acceptance

Migration 017 applied in the AI Study Friends development SQL editor after explicit
approval of Supabase's destructive-operation warning. Success/no rows returned
recorded in assets/learning-branches/migration-017.png. Local API restarted with the
new routes. Live PDF + video goal branch generated a car-velocity path with two
outcomes, explicit coverage gaps and a labelled generated numerical example.
The preview kept the original tangent-slope goal and required confirmation.
After confirmation, both paths remained in the map. The original answer stayed
on its original version; the new branch initially had zero attempts.

Selecting lesson two, waiting for the saved cursor and reloading restored both
the branch and that lesson. Its new application check addressed the misconception
of dividing distance by zero. A submitted answer was saved separately and received
criteria-specific provisional Needs review feedback. Its citation opened the
original video passage at 7:38.700–8:00.760; Escape returned focus to that citation.
Reload retained the branch answer.

The derivative topic panel showed two saved paths, zero studied lessons, two
practice attempts and two provisional checks. Supporting-source coverage stayed
at two; the graph retained its two source-backed relationships. Keyboard activation
of refresh and focus visibility worked. Desktop 1280×720 and narrow 390×844 layouts
were checked, including dark/light appearance; temporary viewport overrides were
reset. Screenshots: goal-branch-preview.png, branch-practice.png,
branch-video-evidence.png, topic-learning-activity-light.png,
topic-learning-narrow.png and branch-lesson-narrow.png in assets/learning-branches.
A stale topic-entry message about combined learning being planned was corrected.

## Remaining rollout gates

Independent held-out source/teaching/assessment cases and measured semantic
routing quality, explicit hosted cost ceiling, complete-request latency, 200-source
capacity, screen-reader and actual 200% browser zoom acceptance remain open.
All feedback stays provisional Needs review. Responsive viewport checks do not
establish actual browser zoom or screen-reader acceptance. No verified streaming/grade/mastery or
public production deployment is claimed. Approved development worker is running.
