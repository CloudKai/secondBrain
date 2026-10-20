"""Quiz storage boundary: JWT RPCs for the learner, service-role RPCs for the backend.

Functions 1-6 run with the learner's JWT and only return what the API may show.
Functions 7-14 run with the server credential through the store's OWN HTTP client
(the request-scoped client closes when a request ends, but generation must not).
Every Postgres error is converted here; no StudyStorageError reaches a route.
"""

import json
import logging
import os
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import httpx
from pydantic import Field

from backend.learning_store import LearningStore
from backend.quiz_grading import summarize_attempt
from backend.quiz_limits import QuizConfig, iso_utc, next_utc_midnight
from backend.quiz_messages import quiz_message
from backend.quiz_models import PublicQuiz, QuizAttemptResult, QuizState
from backend.quiz_rules import DETERMINISTIC_KINDS
from backend.schemas import StrictModel
from backend.study_store import StudyStorageError, StudyStore
from backend.sources import SourceGateway
from backend.quiz_generation import quiz_eligibility

logger = logging.getLogger(__name__)

# code -> HTTP status; kept equal to backend/tests/fixtures/quiz_error_codes.json by a test.
STATUS = {
    "quiz_generation_limit_reached": 429, "quiz_grading_limit_reached": 429, "quiz_attempt_limit_reached": 429,
    "quiz_plan_cap_reached": 429, "quiz_generation_attempts_capped": 429, "quiz_grading_exhausted": 429,
    "quiz_not_ready": 422, "quiz_request_invalid": 422, "quiz_answer_invalid": 422, "quiz_not_found": 404,
    "quiz_plan_not_current": 409, "quiz_evidence_changed": 409, "quiz_generation_in_progress": 409,
    "quiz_attempt_in_progress": 409, "quiz_grading_busy": 409, "quiz_lease_lost": 409, "quiz_request_changed": 409,
    "quiz_request_exhausted": 409, "quiz_attempt_conflict": 409, "quiz_generation_unavailable": 503,
    "quiz_disabled": 503, "quiz_storage_unavailable": 503, "quiz_session_expired": 401,
}
RETRYABLE = frozenset({
    "quiz_generation_in_progress", "quiz_attempt_in_progress", "quiz_grading_busy", "quiz_lease_lost",
    "quiz_generation_unavailable", "quiz_storage_unavailable", "quiz_session_expired",
})
# SQL message -> API code (only these are interpreted, and only when they start with quiz_).
SQL_MESSAGES = {
    **{code: code for code in (
        "quiz_not_found", "quiz_plan_not_current", "quiz_evidence_changed", "quiz_request_changed",
        "quiz_attempt_conflict", "quiz_lease_lost", "quiz_generation_in_progress", "quiz_attempt_in_progress",
        "quiz_grading_busy", "quiz_plan_cap_reached", "quiz_generation_attempts_capped", "quiz_request_exhausted",
        "quiz_attempt_limit_reached", "quiz_grading_exhausted", "quiz_answer_invalid")},
    "quiz_invalid_output": "quiz_storage_unavailable",  # a backend bug: logged at error
    "quiz_usage_invalid": "quiz_storage_unavailable",  # a misconfigured limit: logged at error
}
LOUD_SQL_MESSAGES = frozenset({"quiz_invalid_output", "quiz_usage_invalid"})


def parse_moment(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        moment = datetime.fromisoformat(value)
    except ValueError:
        return None
    return moment.astimezone(UTC) if moment.tzinfo else moment.replace(tzinfo=UTC)


class QuizError(Exception):
    """An API error with a stable `code`. `quiz.py` re-exports this and registers the handler."""

    def __init__(self, code: str, status: int | None = None, message: str | None = None, **extra: Any):
        self.code = code
        self.status = status or STATUS[code]
        self.message = message or quiz_message(code, limit=extra.get("limit", "daily"))
        self.extra = {k: v for k, v in extra.items() if v is not None}
        if isinstance(self.extra.get("resets_at"), str):
            moment = parse_moment(self.extra["resets_at"])
            self.extra["resets_at"] = moment if moment is not None else next_utc_midnight()
        super().__init__(code)

    def body(self) -> dict:
        error = {"code": self.code, "message": self.message, "retryable": self.code in RETRYABLE}
        for name, value in self.extra.items():
            error[name] = iso_utc(value) if isinstance(value, datetime) else value
        return {"detail": self.message, "error": error}


def storage_unavailable(why: str) -> QuizError:
    logger.warning("Quiz storage result rejected: %s", why)
    return QuizError("quiz_storage_unavailable")


def map_storage_error(exc: StudyStorageError, *, service: bool) -> QuizError:
    """Spec 5.3.1 precedence: unique quiz_ message, then 23505, then session, then unavailable."""
    message = exc.message or ""
    if message.startswith("quiz_") and message in SQL_MESSAGES:
        code = SQL_MESSAGES[message]
        if message in LOUD_SQL_MESSAGES:
            logger.error("Quiz storage reported %s", message)
        extra = {}
        if code == "quiz_generation_attempts_capped":
            extra["resets_at"] = next_utc_midnight()
        if code in ("quiz_generation_in_progress", "quiz_attempt_in_progress", "quiz_grading_busy"):
            extra["retry_after_seconds"] = 5
        return QuizError(code, **extra)
    if exc.sqlstate == "23505":
        if "quizzes_one_generating" in message:
            return QuizError("quiz_generation_in_progress", retry_after_seconds=5)
        if "client_attempt_id" in message or "quiz_attempts" in message:
            return QuizError("quiz_attempt_in_progress", retry_after_seconds=5)
    if exc.code == "session":
        if service:
            logger.error("The server credential for quiz storage was rejected")
            return QuizError("quiz_storage_unavailable")
        return QuizError("quiz_session_expired")
    return QuizError("quiz_storage_unavailable")


def server_setup_ready() -> bool:
    """Cheap local check: provider key and server credential configured (no network)."""
    key = os.getenv("OPENAI_API_KEY", "")
    secret = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    return bool(key) and not key.startswith("YOUR_") and bool(secret)


# --- small RPC result models --------------------------------------------------------------


class GenerationClaim(StrictModel):
    quiz_id: UUID
    lease_token: UUID | None
    replay: bool


class AttemptClaim(StrictModel):
    attempt_id: UUID
    lease_token: UUID | None
    replay: bool


class ShortAnswerClaim(StrictModel):
    attempt_id: UUID
    question_id: UUID
    lease_token: UUID | None
    grading_state: str


class UsageGrant(StrictModel):
    allowed: bool
    used: int = Field(ge=0)
    limit: int = Field(ge=1)
    usage_date: str | None = None
    resets_at: str | None = None


def parse(model: type[StrictModel], value: object):
    try:
        return model.model_validate_json(json.dumps(value))
    except (ValueError, TypeError) as exc:
        raise storage_unavailable(f"{model.__name__} did not validate") from exc


class QuizStore:
    def __init__(self, config: QuizConfig, user_id: UUID, project_url: str, learning: LearningStore | None):
        self.config = config
        self.user_id = user_id
        self.project_url = project_url.rstrip("/")
        self.learning = learning
        self._http: httpx.AsyncClient | None = None

    @classmethod
    def for_gateway(cls, gateway: SourceGateway, config: QuizConfig) -> "QuizStore":
        return cls(config, gateway.user_id, gateway.project_url, LearningStore(gateway))

    def detached(self) -> "QuizStore":
        """A store for a background task: service calls only, with its own HTTP client."""
        return QuizStore(self.config, self.user_id, self.project_url, None)

    async def aclose(self) -> None:
        if self._http is not None:
            await self._http.aclose()
            self._http = None

    # -- transports ----------------------------------------------------------------

    async def jwt(self, name: str, **body):
        if self.learning is None:
            raise storage_unavailable("no learner session on a detached store")
        try:
            return await self.learning.call(name, **body)
        except StudyStorageError as exc:
            raise map_storage_error(exc, service=False) from exc

    async def service(self, name: str, **body):
        """Service-role RPC returning the jsonb value. A missing or rejected key is operator trouble."""
        key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not key:
            logger.error("The server credential for quiz storage is not configured")
            raise QuizError("quiz_storage_unavailable")
        if self._http is None:
            self._http = httpx.AsyncClient(timeout=15, trust_env=False)
        transport = StudyStore(self._http, self.project_url, {"apikey": key, "Authorization": f"Bearer {key}"})
        try:
            return await transport.request("/rpc/" + name, body=body)
        except StudyStorageError as exc:
            raise map_storage_error(exc, service=True) from exc

    # -- learner (JWT) functions 1-6 -------------------------------------------------

    async def state(self, collection_id: UUID, plan_id: UUID, include_material: bool = False) -> dict:
        value = await self.jwt("get_quiz_state", p_collection_id=str(collection_id), p_plan_id=str(plan_id),
                               p_include_material=include_material)
        if not isinstance(value, dict) or not isinstance(value.get("plan"), dict) or not isinstance(value.get("attempts"), list):
            raise storage_unavailable("malformed state")
        return value

    async def request_generation(self, collection_id, plan_id, request_id, regenerate: bool) -> GenerationClaim:
        value = await self.jwt("request_quiz_generation", p_collection_id=str(collection_id), p_plan_id=str(plan_id),
                               p_request_id=str(request_id), p_regenerate=regenerate)
        return parse(GenerationClaim, value)

    async def submit_attempt(self, collection_id, plan_id, quiz_id, attempt_key, answers: list[dict], answers_hash: str) -> AttemptClaim:
        value = await self.jwt("submit_quiz_attempt", p_collection_id=str(collection_id), p_plan_id=str(plan_id),
                               p_quiz_id=str(quiz_id), p_attempt_key=str(attempt_key), p_answers=answers,
                               p_answers_hash=answers_hash)
        return parse(AttemptClaim, value)

    async def claim_attempt_grading(self, collection_id, plan_id, attempt_id) -> AttemptClaim:
        value = await self.jwt("claim_quiz_attempt_grading", p_collection_id=str(collection_id),
                               p_plan_id=str(plan_id), p_attempt_id=str(attempt_id))
        return parse(AttemptClaim, value)

    async def attempt(self, collection_id, plan_id, attempt_id) -> dict:
        value = await self.jwt("get_quiz_attempt", p_collection_id=str(collection_id), p_plan_id=str(plan_id),
                               p_attempt_id=str(attempt_id))
        attempt = value.get("attempt") if isinstance(value, dict) else None
        if (not isinstance(attempt, dict) or not isinstance(value.get("answers"), list)
                or str(attempt.get("id")) != str(attempt_id) or str(attempt.get("plan_id")) != str(plan_id)):
            raise storage_unavailable("unexpected attempt")
        return value

    async def claim_short_answer(self, collection_id, plan_id, attempt_id, question_id) -> ShortAnswerClaim:
        value = await self.jwt("claim_quiz_short_answer", p_collection_id=str(collection_id), p_plan_id=str(plan_id),
                               p_attempt_id=str(attempt_id), p_question_id=str(question_id))
        claim = parse(ShortAnswerClaim, value)
        if claim.attempt_id != attempt_id or claim.question_id != question_id:
            raise storage_unavailable("unexpected short-answer claim")
        return claim

    # -- backend (service role) functions 7-14 ---------------------------------------

    async def charge_generation(self, quiz_id, lease, limit: int) -> UsageGrant:
        return parse(UsageGrant, await self.service("charge_quiz_generation", p_quiz_id=str(quiz_id),
                                                    p_lease_token=str(lease), p_limit=limit))

    async def finish_generation(self, quiz_id, lease, stored: dict, model: str, fallback_used: bool, tokens_in: int, tokens_out: int) -> bool:
        value = await self.service("finish_quiz_generation", p_quiz_id=str(quiz_id), p_lease_token=str(lease),
                                   p_quiz=stored, p_model=model, p_fallback_used=fallback_used,
                                   p_tokens_in=tokens_in, p_tokens_out=tokens_out)
        if not isinstance(value, bool):
            raise storage_unavailable("finish_quiz_generation returned a non-boolean")
        return value

    async def fail_generation(self, quiz_id, lease, error_code: str, refund: bool) -> bool:
        value = await self.service("fail_quiz_generation", p_quiz_id=str(quiz_id), p_lease_token=str(lease),
                                   p_error_code=error_code, p_refund=refund)
        return value is True

    async def grading_context(self, attempt_id, lease) -> dict:
        value = await self.service("get_quiz_grading_context", p_attempt_id=str(attempt_id), p_lease_token=str(lease))
        if (not isinstance(value, dict) or str(value.get("user_id")) != str(self.user_id)
                or str(value.get("attempt_id")) != str(attempt_id) or not isinstance(value.get("questions"), list)):
            raise storage_unavailable("unexpected grading context")
        return value

    async def finish_attempt(self, attempt_id, lease, results: dict) -> bool:
        value = await self.service("finish_quiz_attempt", p_attempt_id=str(attempt_id), p_lease_token=str(lease),
                                   p_results=results)
        if not isinstance(value, bool):
            raise storage_unavailable("finish_quiz_attempt returned a non-boolean")
        return value

    async def short_context(self, attempt_id, question_id, lease) -> dict:
        value = await self.service("get_quiz_short_answer_context", p_attempt_id=str(attempt_id),
                                   p_question_id=str(question_id), p_lease_token=str(lease))
        if (not isinstance(value, dict) or str(value.get("user_id")) != str(self.user_id)
                or str(value.get("attempt_id")) != str(attempt_id) or str(value.get("question_id")) != str(question_id)
                or not isinstance(value.get("criteria"), list) or not isinstance(value.get("answer_text"), str)):
            raise storage_unavailable("unexpected short-answer context")
        return value

    async def charge_grading(self, attempt_id, question_id, lease, limit: int) -> UsageGrant:
        return parse(UsageGrant, await self.service("charge_quiz_grading", p_attempt_id=str(attempt_id),
                                                    p_question_id=str(question_id), p_lease_token=str(lease), p_limit=limit))

    async def finish_short_answer(self, attempt_id, question_id, lease, *, feedback: dict | None = None, model: str | None = None,
                                  unavailable_reason: str | None = None, refund: bool = False) -> bool:
        value = await self.service("finish_quiz_short_answer", p_attempt_id=str(attempt_id), p_question_id=str(question_id),
                                   p_lease_token=str(lease), p_feedback=feedback, p_model=model,
                                   p_unavailable_reason=unavailable_reason, p_refund=refund)
        if value is not True:
            raise storage_unavailable("finish_quiz_short_answer did not confirm")
        return True


# --- turning RPC results into API models ---------------------------------------------------


def _public_quiz(raw: dict | None, config: QuizConfig) -> PublicQuiz | None:
    """Explicit field copy: nothing but known public fields can reach a client."""
    if raw is None:
        return None
    try:
        questions = raw["questions"]
        redacted = bool(raw["redacted"]) or any(q.get("redacted") for q in questions)
        public = []
        for q in ([] if redacted else questions):
            row = {"id": q["id"], "kind": q["kind"], "position": q["position"], "outcome_index": q["outcome_index"],
                   "outcome_title": q["outcome_title"], "prompt": q["prompt"]}
            if q["kind"] == "short_answer":
                row["max_chars"] = config.short_answer_max_chars
            else:
                row["options"] = [{"id": o["id"], "text": o["text"]} for o in q["options"]]
            public.append(row)
        value = {"id": raw["id"], "generated_at": raw["generated_at"], "question_count": raw["question_count"],
                 "outcomes": [{"index": o["index"], "title": o["title"]} for o in raw["outcomes"]],
                 "redacted": redacted, "source_version": raw["source_version"], "questions": public}
    except (KeyError, TypeError, AttributeError) as exc:
        raise storage_unavailable("malformed quiz") from exc
    return parse(PublicQuiz, value)


def build_state(rpc: dict, config: QuizConfig) -> QuizState:
    """Derive status, regenerating, can_generate and generate_blocked (Rev 3 #4, #5, #9)."""
    plan, generating = rpc["plan"], bool(rpc.get("generating"))
    quiz = _public_quiz(rpc.get("quiz"), config)
    reason = None
    regenerating = False
    if quiz is not None:
        status, regenerating = "ready", generating
    elif generating:
        status = "generating"
    elif not config.enabled:
        status, reason = "not_ready", "disabled"
    else:
        eligibility = quiz_eligibility(rpc.get("material"), {"confirmed": True, "needs_review": plan.get("needs_review", False)}, config)
        status, reason = ("none", None) if eligibility.ok else ("not_ready", eligibility.reason)
    usage = rpc.get("usage") if isinstance(rpc.get("usage"), dict) else {}
    used = int(usage.get("generation_used") or 0)
    resets = parse_moment(usage.get("resets_at")) or next_utc_midnight()
    active, current = bool(plan.get("is_active")), bool(plan.get("evidence_current"))
    if not config.enabled:
        blocked = "disabled"
    elif not server_setup_ready():
        blocked = "setup"
    elif status == "not_ready":
        blocked = reason
    elif not active:
        blocked = "not_active"
    elif not current:
        blocked = "evidence_changed"
    elif used >= config.generations_per_day:
        blocked = "limit"
    elif status == "generating" or regenerating:
        blocked = "generating"
    else:
        blocked = None
    value = {
        "status": status, "regenerating": regenerating, "not_ready_reason": reason,
        "plan": {"is_active": active, "evidence_current": current, "source_version": plan.get("source_version")},
        "quiz": None if quiz is None else json.loads(quiz.model_dump_json()),
        "attempts": [{k: a[k] for k in ("attempt_id", "quiz_id", "quiz_is_current", "status", "submitted_at", "correct",
                                         "total", "short_answers_total", "short_answers_pending")} for a in rpc["attempts"]],
        "usage": {"generations_used": used, "generations_limit": config.generations_per_day, "resets_at": iso_utc(resets)},
        "can_generate": blocked is None, "generate_blocked": blocked,
        "can_take": status == "ready" and current and quiz is not None and not quiz.redacted,
    }
    return parse(QuizState, value)


def _graded_question(row: dict) -> dict:
    answer = row.get("answer") or {}
    base = {"kind": row["kind"], "question_id": row["question_id"], "position": row["position"],
            "outcome_index": row["outcome_index"]}
    if row.get("redacted"):
        return {**base, "kind": "redacted", "original_kind": row["kind"], "selected_option_ids": answer.get("option_ids", []),
                "answer_text": answer.get("text"), "result": row.get("result"), "signal": row.get("signal")}
    reveal = row["reveal"]
    shared = {**base, "prompt": row["prompt"], "explanation": reveal["explanation"], "citation_ids": reveal["citation_ids"]}
    if row["kind"] in DETERMINISTIC_KINDS:
        return {**shared, "options": [{"id": o["id"], "text": o["text"]} for o in row["options"]],
                "selected_option_ids": answer.get("option_ids", []), "correct_option_ids": reveal["correct_option_ids"],
                "result": row["result"], "signal": row["signal"]}
    feedback = row.get("feedback") or {}
    by_index = {c["criterion_index"]: c for c in feedback.get("criteria") or []}
    criteria = [{"index": i, "text": text, "assessment": by_index.get(i, {}).get("assessment"),
                 "observation": by_index.get(i, {}).get("observation"), "citation_ids": by_index.get(i, {}).get("citation_ids", [])}
                for i, text in enumerate(reveal["criteria"])]
    return {**shared, "answer_text": answer.get("text", ""), "result": row.get("result"), "signal": row.get("signal"),
            "grading_state": row["grading_state"], "unavailable_reason": row.get("unavailable_reason"),
            "criteria": criteria, "feedback_summary": feedback.get("summary"), "next_hint": feedback.get("next_hint"),
            "model_answer": reveal["model_answer"], "provisional": True}


def build_attempt_result(rpc: dict, config: QuizConfig) -> QuizAttemptResult:
    """A graded attempt as the API returns it; summary fields are recomputed from the stored results."""
    attempt, rows = rpc["attempt"], rpc["answers"]
    if attempt.get("status") != "graded":
        raise storage_unavailable("attempt is not graded")
    try:
        questions = [_graded_question(row) for row in rows]
        outcomes = sorted({(r["outcome_index"], r["outcome_title"]) for r in rows})
        summary = summarize_attempt(
            [{"kind": r["kind"], "outcome_index": r["outcome_index"], "result": r.get("result")} for r in rows],
            [{"index": i, "title": t} for i, t in outcomes])
        if summary["score"] != {"correct": attempt["correct"], "total": attempt["total"]}:
            raise ValueError("stored score disagrees with the stored results")
        reset = parse_moment(rpc.get("grading_resets_at")) or next_utc_midnight()
        usage = ({"used": rpc.get("grading_used") or 0, "limit": config.gradings_per_day, "resets_at": iso_utc(reset)}
                 if attempt["short_answers_total"] else None)
        value = {"attempt_id": attempt["id"], "quiz_id": attempt["quiz_id"], "plan_id": attempt["plan_id"],
                 "quiz_is_current": attempt["quiz_is_current"], "submitted_at": attempt["submitted_at"], **summary,
                 "grading_usage": usage, "questions": questions}
    except (KeyError, TypeError, ValueError, AttributeError) as exc:
        raise storage_unavailable(f"malformed attempt ({type(exc).__name__})") from exc
    return parse(QuizAttemptResult, value)
