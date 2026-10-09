# U2c1 unfinished learning work contract

**Target behavior until accepted.** Part of #29, after U2a identity and U2b workspace. This reviewable unit persists practice-answer and tutor-question drafts; completed tutor conversations are the next U2c2 unit. Reuse the approved authenticated learning API, Postgres public RPC/ownership, provider HTTP and browser learning seams. Starting commit: e914172 plus existing unrelated WIP.

## Identity, save and conflict rules

- Each owned collection, immutable plan revision, lesson index and lesson scope has separate answer and tutor-question draft slots. Answer maximum 5,000 Unicode characters; question maximum 2,000, matching existing submission boundaries. Empty text clears a slot through a revision-checked write.
- Postgres is authoritative. Reads and writes check the authenticated owner and actual collection/plan/lesson relationship. A draft is never an attempt, assistant reply, source evidence or progress event.
- Autosave after a short typing pause, with Saving/Saved/Unsaved/Retry status. A tab-private session-storage copy is keyed to the session owner, browser tab and exact slot, retaining text across same-tab navigation/reload or a failed request. A separate tab inherits at most a copy of pending text; future saves cannot modify another tab’s recovery storage. Closing the tab before server save can discard pending work; Saved means the durable server write was confirmed. If local storage fails, explain that the pending copy is only in memory until server save succeeds.
- Serialize reads and writes per slot. A reopening read cannot overwrite a completed save. Separate tab recovery copies prevent another tab’s save from clearing pending text. Expected server revisions prevent last-write-wins between tabs. A UUID save identifier makes an immediate retry after a lost response idempotent. Conflicts retain local text and show the newer saved text, with explicit Use saved version or Replace saved with my draft choices. Never overwrite a conflicting draft automatically.
- Clear user-scoped pending cache and cancel queued work when the authenticated owner changes or signs out. Do not move drafts between owners, levels, branches or revised checks.
- Submitted answers remain append-only practice attempts. This unit does not erase a draft automatically after submission; explain the distinction and provide Clear saved draft. Reusing an earlier answer updates the current draft without editing the old attempt.

## Retention, deletion and recovery

- Server drafts remain until the learner clears that slot or its collection/plan/account is deleted. No silent expiry. Clearing produces an empty, revisioned slot and removes the pending browser copy; it does not delete submitted answers or sources.
- Source changes/removal retain learner-authored drafts under their original plan. Show that evidence needs review, prevent stale practice/model generation, and expose unfinished work from retained collection history. Source capture deletion never copies removed excerpts into draft storage; only learner-authored input is stored here.
- Provide Download this draft (versioned JSON containing slot identity, learner text, save revision/state) as a narrow recovery action. It is not a whole-library/account export or recovery promise; those remain U5 contracts.
- U2c2 must separately define completed conversation message provenance, source-removal redaction, bounded model context, failed-send idempotency, deletion and export before enabling retained replies. Current tutor replies remain view-local in U2c1.

## Migration and recovery

Migration 020 is additive: owned draft table and authenticated read/checked-save RPCs, with no existing text/history rewrite. Recovery disables new writes while retaining reads, drafts, collection access and old learning writers. Do not drop learner work during rollback. Backfill is unnecessary: existing client-only unfinished text cannot be reconstructed.

## Acceptance

Test actual RPC/RLS ownership, confirmed-plan/lesson bounds, exact Unicode/whitespace, same-save retry, two stale writers, separate plan/lesson/kind identity, retained source-change/removal work and recovery preservation. Test authenticated HTTP identities and strict responses. Browser checks cover save/reopen/reload, local failure/retry, two tabs with visible conflict, evidence return, no increased attempts/activity, download/clear, keyboard and both themes/layouts. Record actual zoom/screen-reader limitations honestly. No live model requests needed for this unit.
