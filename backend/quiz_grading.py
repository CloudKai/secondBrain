"""Deterministic grading, signals, outcome labels and the attempt summary.

Standard library only. Results are evidence for the learner, never a verdict:
the words "mastered" and "passed" appear nowhere in this module's outputs.
"""

from collections.abc import Iterable, Mapping, Sequence

from backend.quiz_rules import DETERMINISTIC_KINDS

POSITIVE, NEGATIVE, NEUTRAL = "positive", "negative", "neutral"
LOOKS_SOLID, WORTH_REVIEWING = "looks_solid", "worth_reviewing"
MAX_REVIEW_FIRST = 3

_SIGNALS = {
    "correct": POSITIVE,
    "addressed": POSITIVE,
    "incorrect": NEGATIVE,
    "partly_correct": NEGATIVE,
    "unanswered": NEGATIVE,
    "needs_review": NEGATIVE,
}


def grade_choice(kind: str, correct_ids: Iterable[str], selected_ids: Iterable[str]) -> str:
    """G2-G4. Option sets compare by value: order and duplicates are ignored."""
    correct, selected = set(correct_ids), set(selected_ids)
    if kind not in DETERMINISTIC_KINDS:
        raise ValueError("Not a choice question")
    if not selected:
        return "unanswered"
    if selected == correct:
        return "correct"
    if kind == "multi_select" and selected < correct:
        return "partly_correct"
    return "incorrect"


def signal_for(result: str | None) -> str:
    """One normalised signal per question result (None = not graded yet)."""
    return _SIGNALS.get(result or "", NEUTRAL)


def short_answer_result(
    assessments: Sequence[str] = (), *, blank: bool = False, unavailable: bool = False
) -> tuple[str, str]:
    """G6: (result, signal) for one short answer."""
    if blank:
        return "unanswered", NEGATIVE
    if unavailable:
        return "unavailable", NEUTRAL
    if not assessments:
        raise ValueError("A graded short answer needs at least one assessment")
    if any(a not in ("addressed", "try_again", "uncertain") for a in assessments):
        raise ValueError("Unknown assessment")
    if all(a == "addressed" for a in assessments):
        result = "addressed"
    elif any(a == "try_again" for a in assessments):
        result = "needs_review"
    else:
        result = "uncertain"
    return result, signal_for(result)


def outcome_label(correct: int, to_review: int, short_needs_review: int, short_blank: int) -> str:
    solid = correct >= 2 and to_review == 0 and short_needs_review == 0 and short_blank == 0
    return LOOKS_SOLID if solid else WORTH_REVIEWING


def _kind(question: Mapping) -> str:
    return question.get("kind") if question.get("kind") != "redacted" else question.get("original_kind", "")


def summarize_attempt(questions: Iterable[Mapping], outcomes: Sequence[Mapping]) -> dict:
    """Score, per-outcome labels, review order and short-answer totals.

    `questions` hold `kind` (or `original_kind` when redacted), `outcome_index` and
    `result` (None while a short answer is pending). Recomputed on every read, so a
    label can move when feedback lands.
    """
    rows = list(questions)
    deterministic = [q for q in rows if _kind(q) in DETERMINISTIC_KINDS]
    short = [q for q in rows if _kind(q) == "short_answer"]
    summary = []
    for outcome in outcomes:
        index = outcome["index"]
        det = [q for q in deterministic if q.get("outcome_index") == index]
        shorts = [q.get("result") for q in short if q.get("outcome_index") == index]
        correct = sum(1 for q in det if q.get("result") == "correct")
        to_review = sum(1 for q in det if q.get("result") in ("incorrect", "partly_correct", "unanswered"))
        needs_review = sum(1 for r in shorts if r == "needs_review")
        blank = sum(1 for r in shorts if r == "unanswered")
        open_ = sum(1 for r in shorts if r in (None, "unavailable", "uncertain"))
        summary.append({
            "index": index, "title": outcome["title"],
            "label": outcome_label(correct, to_review, needs_review, blank),
            "ai_contributed": needs_review > 0,
            "correct": correct, "to_review": to_review,
            "short_needs_review": needs_review, "short_blank": blank, "short_open": open_,
        })
    worth = [o for o in summary if o["label"] == WORTH_REVIEWING]
    worth.sort(key=lambda o: (-(o["to_review"] + o["short_needs_review"] + o["short_blank"]), o["index"]))
    return {
        "score": {"correct": sum(1 for q in deterministic if q.get("result") == "correct"), "total": len(deterministic)},
        "outcomes": summary,
        "review_first": [o["index"] for o in worth[:MAX_REVIEW_FIRST]],
        "short_answers": {
            "total": len(short),
            "pending": sum(1 for q in short if q.get("result") is None),
            "unavailable": sum(1 for q in short if q.get("result") == "unavailable"),
        },
    }
