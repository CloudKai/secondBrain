"""Pure quiz rules: standard library only, so they are testable without Pydantic.

Everything here works on plain dicts and lists. The Pydantic models, the provider
shim and the routes call these functions; none of them is defined twice.
"""

import hashlib
import json
import re
import unicodedata
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

DETERMINISTIC_KINDS = ("single_choice", "true_false", "multi_select")
QUESTION_KINDS = (*DETERMINISTIC_KINDS, "short_answer")
MAX_SHORT_ANSWERS = 2
PER_LESSON_DETERMINISTIC = (2, 4)

# Option ids that a model must never put in prose (cf. citation_grounding).
_EVIDENCE_LABELS = re.compile(r"\bp\d{4}\b|\bref\d+\b|\bsource\d+\b", re.IGNORECASE)
_NONE_OF_THE_ABOVE = re.compile(
    r"\ball of the above\b|\bnone of the above\b|\bboth [a-e] and [a-e]\b", re.IGNORECASE
)
_TOKEN = re.compile(r"[^\W_]+")
STOP_WORDS = frozenset(
    "the and for are but not you all any can had her was one our out has his how its "
    "may new now see two who did get him she too use way with that this from they have "
    "will your what when which their there these those been were than then them into "
    "also each more most some such only over very just about after before because "
    "while where would could should does doing being both either other".split()
)

# --- cited set per lesson ---------------------------------------------------------


def cited_ids(lesson: Mapping, reference_ids: Iterable[str]) -> list[str]:
    """Explanation, worked answer and source-backed example ids, in first-seen order.

    Generated examples contribute nothing; ids missing from the plan's references
    are dropped.
    """
    known = set(reference_ids)
    groups: list[Sequence[str]] = [
        (lesson.get("explanation") or {}).get("citation_ids") or [],
        (((lesson.get("check") or {}).get("worked_answer")) or {}).get("citation_ids") or [],
    ]
    example = lesson.get("example")
    if example and example.get("provenance") == "source_backed":
        groups.append(example.get("citation_ids") or [])
    ordered: list[str] = []
    for group in groups:
        for item in group:
            if item in known and item not in ordered:
                ordered.append(item)
    return ordered


# --- quiz shape -------------------------------------------------------------------


@dataclass(frozen=True)
class QuizShape:
    short_max: int
    l_cov: int
    covered: tuple  # the quizzable items (lesson indices) the quiz covers
    det_min: int
    short_min: int
    total_min: int
    total_max: int
    per_lesson_min: int = PER_LESSON_DETERMINISTIC[0]
    per_lesson_max: int = PER_LESSON_DETERMINISTIC[1]

    @property
    def feasible(self) -> bool:
        return self.total_min <= self.total_max


def quiz_shape(max_q: int, short_cfg: int, quizzable: Sequence) -> QuizShape:
    """Shape of the quiz to request (spec 8.1 step 4, Revision 3 #11).

    The final quizzable lesson is always covered.
    """
    short_max = max(0, min(short_cfg, MAX_SHORT_ANSWERS, max_q - 4))
    wanted = max(1, (max_q - short_max) // 2)
    count = len(quizzable)
    l_cov = min(count, wanted)
    if count == 0:
        covered: tuple = ()
    elif l_cov >= count:
        covered = tuple(quizzable)
    elif l_cov == 1:
        covered = (quizzable[-1],)
    else:
        covered = (*quizzable[: l_cov - 1], quizzable[-1])
    det_min = max(3, 2 * l_cov)
    short_min = min(1, short_max)
    return QuizShape(short_max, l_cov, covered, det_min, short_min, det_min + short_min, max_q)


# --- generated-output validation (V2-V10) -----------------------------------------


def content_tokens(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.lower()) if len(t) >= 3 and t not in STOP_WORDS]


def _overlaps(text: str, excerpts: Sequence[str]) -> bool:
    tokens = set(content_tokens(text))
    if not tokens:
        return False
    need = min(3, len(tokens))
    return any(len(tokens & set(content_tokens(excerpt))) >= need for excerpt in excerpts)


def overlap_ok(text: str, excerpts: Sequence[str]) -> bool:
    """Overlap guard (V10): min(3, n) shared content tokens with ONE excerpt."""
    return _overlaps(text, excerpts)


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def criteria_of(question: Mapping) -> list[str]:
    return [c for c in (question.get("criteria") or []) if isinstance(c, str)]


def _strings(question: Mapping) -> list[str]:
    values = [question.get("prompt", ""), question.get("explanation", ""), question.get("model_answer") or ""]
    values += [o.get("text", "") for o in question.get("options") or []]
    values += list(question.get("criteria") or [])
    return [v for v in values if isinstance(v, str)]


def check_generated(
    quiz: Mapping,
    admitted_ids: Mapping[str, str],
    cited_by_lesson: Mapping[int, Sequence[str]],
    shape: QuizShape,
) -> list[str]:
    """Return rule violations (empty list = valid). Reasons name rules, never text.

    `admitted_ids` maps each admitted evidence id to its excerpt. `cited_by_lesson`
    maps a lesson index to the ids that lesson cites.
    """
    reasons: list[str] = []
    questions = list(quiz.get("questions") or [])
    deterministic = [q for q in questions if q.get("kind") in DETERMINISTIC_KINDS]
    short = [q for q in questions if q.get("kind") == "short_answer"]
    # V2 counts
    if not shape.total_min <= len(questions) <= shape.total_max:
        reasons.append(f"V2: question count {len(questions)} outside {shape.total_min}-{shape.total_max}")
    if len(deterministic) < shape.det_min:
        reasons.append(f"V2: needs at least {shape.det_min} choice questions")
    if not shape.short_min <= len(short) <= shape.short_max:
        reasons.append(f"V2: short-answer count must be {shape.short_min}-{shape.short_max}")
    if len(deterministic) + len(short) != len(questions):
        reasons.append("V2: unknown question kind")
    per_lesson: dict[int, int] = {}
    prompts: set[str] = set()
    for number, q in enumerate(questions):
        tag = f"question {number + 1}"
        kind = q.get("kind")
        lesson = q.get("lesson_index")
        options = q.get("options") or []
        correct = [o for o in options if o.get("is_correct") is True]
        if lesson not in shape.covered:  # V3
            reasons.append(f"V3: {tag} lesson is not covered")
        if kind == "single_choice" and (len(options) != 4 or len(correct) != 1):
            reasons.append(f"V4: {tag} single_choice needs 4 options with exactly 1 correct")
        elif kind == "true_false":
            texts = sorted(_norm(o.get("text", "")) for o in options)
            if texts != ["false", "true"] or len(correct) != 1:
                reasons.append(f"V4: {tag} true_false needs True and False with exactly 1 correct")
        elif kind == "multi_select" and (len(options) != 5 or len(correct) not in (2, 3)):
            reasons.append(f"V4: {tag} multi_select needs 5 options with 2 or 3 correct")
        elif kind == "short_answer" and options:
            reasons.append(f"V4: {tag} short_answer takes no options")
        if kind != "multi_select" and len(correct) > 1:  # V9
            reasons.append(f"V9: {tag} has more than one correct option")
        strings = _strings(q)  # V5
        required = [q.get("prompt", ""), q.get("explanation", ""), *[o.get("text", "") for o in options], *criteria_of(q)]
        if any(not s.strip() for s in required):
            reasons.append(f"V5: {tag} has an empty text")
        if any(s != s.strip() for s in strings):
            reasons.append(f"V5: {tag} has untrimmed text")
        option_texts = [_norm(o.get("text", "")) for o in options]
        if len(set(option_texts)) != len(option_texts):
            reasons.append(f"V5: {tag} repeats an option text")
        if _norm(q.get("prompt", "")) in prompts:
            reasons.append(f"V5: {tag} repeats a prompt")
        prompts.add(_norm(q.get("prompt", "")))
        if any(_NONE_OF_THE_ABOVE.search(t) for t in option_texts):
            reasons.append(f"V5: {tag} uses an 'all/none of the above' option")
        if any(_EVIDENCE_LABELS.search(s) for s in strings):
            reasons.append(f"V5: {tag} mentions an evidence id or private label")
        cites = q.get("citation_ids") or []  # V7
        allowed = set(cited_by_lesson.get(lesson, ()))
        if not 1 <= len(cites) <= 3:
            reasons.append(f"V7: {tag} needs 1-3 citations")
        elif len(set(cites)) != len(cites):
            reasons.append(f"V7: {tag} repeats a citation")
        elif any(c not in admitted_ids for c in cites):
            reasons.append(f"V7: {tag} cites an evidence id that was not supplied")
        elif any(c not in allowed for c in cites):
            reasons.append(f"V7: {tag} cites evidence outside its lesson")
        criteria = q.get("criteria") or []  # V8
        answer = q.get("model_answer")
        if kind == "short_answer":
            if not 2 <= len(criteria) <= 4 or not (isinstance(answer, str) and answer.strip()):
                reasons.append(f"V8: {tag} short_answer needs 2-4 criteria and a model answer")
        elif criteria or answer is not None:
            reasons.append(f"V8: {tag} only short_answer carries criteria or a model answer")
        if kind in DETERMINISTIC_KINDS:
            per_lesson[lesson] = per_lesson.get(lesson, 0) + 1
        excerpts = [admitted_ids[c] for c in allowed if c in admitted_ids]  # V10
        if kind in ("single_choice", "multi_select", "true_false"):
            for o in correct:
                if kind != "true_false" and not _overlaps(o.get("text", ""), excerpts):
                    reasons.append(f"V10: {tag} a correct option has too little evidence overlap")
            if kind == "true_false" and not _overlaps(q.get("prompt", ""), excerpts):
                reasons.append(f"V10: {tag} true_false prompt has too little evidence overlap")
        elif kind == "short_answer" and isinstance(answer, str) and not _overlaps(answer, excerpts):
            reasons.append(f"V10: {tag} model answer has too little evidence overlap")
    low, high = shape.per_lesson_min, shape.per_lesson_max  # V6
    for lesson in shape.covered:
        if not low <= per_lesson.get(lesson, 0) <= high:
            reasons.append(f"V6: lesson {lesson} needs {low}-{high} choice questions")
    return reasons


# --- learner answers --------------------------------------------------------------


def normalize_answer_text(text: str) -> str:
    """NFC, LF newlines, no control characters except newline/tab, stripped."""
    value = unicodedata.normalize("NFC", text)
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = value.replace("\u2028", "\n").replace("\u2029", "\n")
    value = "".join(
        ch for ch in value if ch in "\n\t" or unicodedata.category(ch) not in ("Cc", "Cf")
    )
    return value.strip()


def canonical_answers_hash(answers: Iterable[Mapping]) -> str:
    """sha256 of the answers, so a reordered but identical payload is a replay.

    Entries are `{question_id, kind, option_id | option_ids | text}`; a nested
    `answer` object holding those members is accepted too. Unanswered entries are
    dropped.
    """
    entries = []
    for entry in answers:
        body = entry.get("answer") if isinstance(entry.get("answer"), Mapping) else entry
        ids = set(body.get("option_ids") or [])
        if body.get("option_id"):
            ids.add(body["option_id"])
        text = normalize_answer_text(body.get("text") or "")
        if text:
            entries.append({"question_id": str(entry["question_id"]), "kind": entry.get("kind"), "text": text})
        elif ids:
            entries.append({"question_id": str(entry["question_id"]), "kind": entry.get("kind"), "option_ids": sorted(ids)})
    entries.sort(key=lambda item: item["question_id"])
    canonical = json.dumps(entries, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# --- provider outcome classification (refund allow-list, spec 7.3) -----------------

_UNSPENT_ERRORS = frozenset({"ConnectError", "ConnectTimeout"})
_UNSPENT_STATUS = frozenset({400, 401, 403, 404})
_OWNER_CAUSED_429 = frozenset({"invalid_request_error", "insufficient_quota"})


def refundable_error_type(body: object) -> str | None:
    """Pull `error.type` / `error.code` out of an OpenAI error body (both optional).

    A refundable value wins over a non-refundable one when the two disagree.
    """
    error = body.get("error") if isinstance(body, Mapping) else None
    if not isinstance(error, Mapping):
        return None
    values = [v for v in (error.get("type"), error.get("code")) if isinstance(v, str)]
    for value in values:
        if value in _OWNER_CAUSED_429:
            return value
    return values[0] if values else None


def classify_outcome(kind: str, status: int | None = None, error_type: str | None = None) -> str:
    """Return "unspent" only for the provably unspent allow-list, else "spent".

    `kind` is "not_started" (no request was sent), "http" (a response arrived with
    `status`), or an exception class name such as "ConnectError". Class names are
    matched exactly, so ConnectTimeout is unspent while TimeoutException,
    ReadTimeout, WriteTimeout, PoolTimeout, CancelledError and
    RemoteProtocolError are spent.
    """
    if kind == "not_started":
        return "unspent"
    if kind == "http":
        if status in _UNSPENT_STATUS:
            return "unspent"
        if status == 429 and error_type in _OWNER_CAUSED_429:
            return "unspent"
        return "spent"
    return "unspent" if kind in _UNSPENT_ERRORS else "spent"
