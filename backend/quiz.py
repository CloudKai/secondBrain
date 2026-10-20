"""Path quiz routes: state, generation, attempts, grading and provisional AI feedback.

Generation runs in a detached task with its own HTTP client so that a reload or a
dropped connection cannot burn a unit of the daily allowance and discard the
output. QUIZ_ENABLED switches off spending only (generation and feedback).
"""

import asyncio
import logging
from collections.abc import AsyncIterator
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse

from backend.quiz_generation import QuizGenerationFailure, build_stored_quiz, generate_quiz, lesson_outcome_titles, quiz_eligibility
from backend.quiz_grading import grade_choice, signal_for
from backend.quiz_limits import ProviderLedger, QuizConfig, QuizLimitReached, get_quiz_config, metered_call, next_utc_midnight, seconds_until
from backend.quiz_models import (
    ChoiceAnswer, MultiSelectAnswer, QuizAttemptResult, QuizGenerateRequest, QuizState, QuizSubmitRequest,
)
from backend.quiz_provider import QuizModel, get_quiz_model
from backend.quiz_rules import canonical_answers_hash, normalize_answer_text
from backend.quiz_short_answer import AnswerTooLong, ShortAnswerUnavailable, grade_short_answer
from backend.quiz_store import (
    QuizError, QuizStore, build_attempt_result, build_state, parse_moment, storage_unavailable,
)
from backend.sources import SourceGateway, owned_sources

logger = logging.getLogger(__name__)
RETRY_SECONDS = 5

__all__ = ["QuizError", "quiz_error_handler", "router"]


async def no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


async def quiz_store(gateway: SourceGateway = Depends(owned_sources), config: QuizConfig = Depends(get_quiz_config)) -> AsyncIterator[QuizStore]:
    store = QuizStore.for_gateway(gateway, config)
    try:
        yield store
    finally:
        await store.aclose()


router = APIRouter(prefix="/learning/collections/{collection_id}/plans/{plan_id}/quiz", tags=["learning quiz"],
                   dependencies=[Depends(no_store)])
_TASKS: set[asyncio.Task] = set()


async def quiz_error_handler(_request: Request, exc: QuizError) -> JSONResponse:
    headers = {"Cache-Control": "no-store"}
    resets = exc.extra.get("resets_at")
    if exc.status == 429 and resets is not None:
        moment = resets if isinstance(resets, datetime) else parse_moment(resets)
        if moment is not None:
            headers["Retry-After"] = str(seconds_until(moment))
    return JSONResponse(exc.body(), status_code=exc.status, headers=headers)


def limit_error(code: str, reached: QuizLimitReached) -> QuizError:
    resets = reached.resets_at if isinstance(reached.resets_at, datetime) else parse_moment(reached.resets_at)
    return QuizError(code, limit=reached.limit, used=reached.used, resets_at=resets or next_utc_midnight())


# --- 1. state ---------------------------------------------------------------------------


@router.get("", response_model=QuizState)
async def read_state(collection_id: UUID, plan_id: UUID, store: QuizStore = Depends(quiz_store)):
    return build_state(await store.state(collection_id, plan_id), store.config)


# --- 2. generation ------------------------------------------------------------------------


class StaleQuiz(Exception):
    """finish_quiz_generation said the plan changed while the model was working."""


def failure_code(error) -> str:
    if error == "limit":
        return "limit"  # the database deletes the row: nothing was generated or kept
    if isinstance(error, QuizGenerationFailure):
        return error.reason
    if isinstance(error, StaleQuiz):
        return "stale"
    if isinstance(error, QuizError):
        return "storage"
    if isinstance(error, asyncio.CancelledError):
        return "cancelled"
    return "error"


async def run_generation(store: QuizStore, model: QuizModel, quiz_id: UUID, lease: UUID, content: dict, eligibility) -> None:
    """charge -> provider -> finish/fail, owning its own client. Raises QuizError for the caller."""
    config, ledgers = store.config, []

    async def charge():
        return (await store.charge_generation(quiz_id, lease, config.generations_per_day)).model_dump()

    async def work(ledger: ProviderLedger):
        ledgers.append(ledger)
        quiz, use = await generate_quiz(model, config, content, eligibility.evidence, eligibility.shape, ledger)
        return build_stored_quiz(quiz, lesson_outcome_titles(content)), use

    async def finish(result):
        stored, use = result
        for attempt in range(2):  # a transient storage error is retried once, immediately
            try:
                saved = await store.finish_generation(quiz_id, lease, stored, use.model, use.fallback_used, use.tokens_in, use.tokens_out)
                break
            except QuizError as exc:
                if exc.code != "quiz_storage_unavailable" or attempt == 1:
                    logger.warning("Quiz output discarded: storage unavailable")
                    raise
        if not saved:
            raise StaleQuiz()

    async def fail(error, refund: bool):
        await store.fail_generation(quiz_id, lease, failure_code(error), refund)

    def charged() -> bool:
        return bool(ledgers) and not ledgers[0].refundable

    try:
        await metered_call(charge, work, finish, fail)
    except QuizLimitReached as reached:
        raise limit_error("quiz_generation_limit_reached", reached) from reached
    except QuizGenerationFailure as failure:
        raise QuizError("quiz_generation_unavailable", reason=failure.reason, charged=charged()) from failure
    except StaleQuiz as stale:
        raise QuizError("quiz_evidence_changed") from stale
    except QuizError as error:
        if ledgers and error.code == "quiz_storage_unavailable":  # the provider ran: the output was lost on the way in
            raise QuizError("quiz_generation_unavailable", reason="provider_unavailable", charged=charged()) from error
        raise
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001 - never leak provider or internal text
        logger.error("Quiz generation failed unexpectedly: %s", type(exc).__name__)
        raise QuizError("quiz_generation_unavailable", reason="provider_unavailable", charged=charged()) from exc
    finally:
        await store.aclose()


def forget(task: asyncio.Task) -> None:
    _TASKS.discard(task)
    if not task.cancelled():
        task.exception()  # retrieved here, so an abandoned task never logs "never retrieved"


async def release_unstarted(store: QuizStore, quiz_id: UUID, lease: UUID) -> None:
    """Drop a lease that never reached the provider. 'limit' deletes the row and keeps nothing."""
    try:
        await store.fail_generation(quiz_id, lease, "limit", False)
    except QuizError:
        pass  # the 150 s lease expiry is the backstop
    finally:
        await store.aclose()


@router.post("", response_model=QuizState)
async def generate(
    collection_id: UUID, plan_id: UUID, payload: QuizGenerateRequest, response: Response,
    store: QuizStore = Depends(quiz_store), model: QuizModel = Depends(get_quiz_model),
):
    claim = await store.request_generation(collection_id, plan_id, payload.request_id, payload.regenerate)
    if claim.lease_token is None:  # a replay or an existing quiz: nothing is charged
        response.status_code = 200
        return build_state(await store.state(collection_id, plan_id), store.config)
    detached = store.detached()
    try:
        rpc = await store.state(collection_id, plan_id, include_material=True)
        eligibility = quiz_eligibility(rpc.get("material"), {"confirmed": True, "needs_review": rpc["plan"].get("needs_review", False)}, store.config)
        if not eligibility.ok:
            raise QuizError("quiz_not_ready", reason=eligibility.reason)
        if not store.config.enabled:
            raise QuizError("quiz_disabled")
    except BaseException:
        await asyncio.shield(release_unstarted(detached, claim.quiz_id, claim.lease_token))
        raise
    task = asyncio.create_task(run_generation(detached, model, claim.quiz_id, claim.lease_token, rpc["material"]["content"], eligibility))
    _TASKS.add(task)
    task.add_done_callback(forget)
    await asyncio.shield(task)  # an outer cancel leaves the task running
    response.status_code = 201
    return build_state(await store.state(collection_id, plan_id), store.config)


# --- 3. attempts ----------------------------------------------------------------------------


def stored_answers(payload: QuizSubmitRequest, config: QuizConfig) -> list[dict]:
    """The `p_answers` shape: {question_id, kind, answer}; text is normalised before it is stored."""
    ids = [a.question_id for a in payload.answers]
    if len(set(ids)) != len(ids):
        raise QuizError("quiz_answer_invalid")
    stored = []
    for item in payload.answers:
        if isinstance(item, ChoiceAnswer):
            answer = {"option_ids": [item.option_id]} if item.option_id else {}
        elif isinstance(item, MultiSelectAnswer):
            answer = {"option_ids": sorted(set(item.option_ids))} if item.option_ids else {}
        else:
            text = normalize_answer_text(item.text)
            if len(text) > config.short_answer_max_chars:
                raise QuizError("quiz_answer_invalid")
            answer = {"text": text} if text else {}
        stored.append({"question_id": str(item.question_id), "kind": item.kind, "answer": answer})
    return stored


def build_results(context: dict) -> dict:
    """Deterministic grading from the key snapshot; short answers stay pending (or blank)."""
    results, correct = [], 0
    for q in context["questions"]:
        answer = q.get("answer") or {}
        if q["kind"] == "short_answer":
            blank = not answer.get("text")
            result, signal = ("unanswered", "negative") if blank else (None, "neutral")
            reveal = {"explanation": q["explanation"], "citation_ids": q["citation_ids"],
                      "criteria": q["criteria"], "model_answer": q["model_answer"]}
        else:
            result = grade_choice(q["kind"], q["correct_option_ids"], answer.get("option_ids", []))
            signal = signal_for(result)
            correct += result == "correct"
            reveal = {"correct_option_ids": q["correct_option_ids"], "explanation": q["explanation"], "citation_ids": q["citation_ids"]}
        results.append({"question_id": q["question_id"], "result": result, "signal": signal, "reveal": reveal})
    return {"correct_count": correct, "results": results}


async def grade_attempt(store: QuizStore, attempt_id: UUID, lease: UUID) -> None:
    context = await store.grading_context(attempt_id, lease)
    try:
        results = build_results(context)
    except (KeyError, TypeError, ValueError) as exc:
        logger.error("Quiz grading code rejected the key snapshot: %s", type(exc).__name__)
        raise storage_unavailable("grading input") from exc
    if not await store.finish_attempt(attempt_id, lease, results):
        raise QuizError("quiz_attempt_in_progress", retry_after_seconds=RETRY_SECONDS)


@router.post("/attempts", response_model=QuizAttemptResult)
async def submit(collection_id: UUID, plan_id: UUID, payload: QuizSubmitRequest, response: Response, store: QuizStore = Depends(quiz_store)):
    answers = stored_answers(payload, store.config)
    claim = await store.submit_attempt(collection_id, plan_id, payload.quiz_id, payload.attempt_key, answers, canonical_answers_hash(answers))
    if claim.lease_token is not None:
        await grade_attempt(store, claim.attempt_id, claim.lease_token)
    result = build_attempt_result(await store.attempt(collection_id, plan_id, claim.attempt_id), store.config)
    response.status_code = 200 if claim.replay else 201
    return result


@router.get("/attempts/{attempt_id}", response_model=QuizAttemptResult)
async def read_attempt(collection_id: UUID, plan_id: UUID, attempt_id: UUID, store: QuizStore = Depends(quiz_store)):
    rpc = await store.attempt(collection_id, plan_id, attempt_id)
    if rpc["attempt"].get("status") != "graded":
        if rpc["attempt"].get("lease_live"):
            raise QuizError("quiz_attempt_in_progress", retry_after_seconds=RETRY_SECONDS)
        claim = await store.claim_attempt_grading(collection_id, plan_id, attempt_id)  # self-heal an interrupted submit
        if claim.lease_token is not None:
            await grade_attempt(store, attempt_id, claim.lease_token)
        rpc = await store.attempt(collection_id, plan_id, attempt_id)
    return build_attempt_result(rpc, store.config)


# --- 5. provisional AI feedback --------------------------------------------------------------


def unavailable_reason(error) -> str | None:
    if error == "limit":
        return "limit"
    if isinstance(error, ShortAnswerUnavailable):
        return error.reason
    if isinstance(error, AnswerTooLong):
        return "invalid_output"
    if isinstance(error, QuizError):
        return None  # storage trouble: leave the lease to expire
    if isinstance(error, asyncio.CancelledError):
        return "timeout"
    return "provider"


@router.post("/attempts/{attempt_id}/feedback/{question_id}", response_model=QuizAttemptResult)
async def feedback(
    collection_id: UUID, plan_id: UUID, attempt_id: UUID, question_id: UUID,
    store: QuizStore = Depends(quiz_store), model: QuizModel = Depends(get_quiz_model),
):
    config = store.config
    if not config.enabled:
        raise QuizError("quiz_disabled")
    rpc = await store.attempt(collection_id, plan_id, attempt_id)
    row = next((r for r in rpc["answers"] if str(r.get("question_id")) == str(question_id)), None)
    if row is None:
        raise QuizError("quiz_not_found")
    if rpc["attempt"].get("status") != "graded":
        raise QuizError("quiz_attempt_in_progress", retry_after_seconds=RETRY_SECONDS)
    text = (row.get("answer") or {}).get("text")
    if row.get("kind") != "short_answer" or row.get("redacted") or not text:
        raise QuizError("quiz_request_invalid")
    if row.get("grading_state") == "graded":
        return build_attempt_result(rpc, config)
    claim = await store.claim_short_answer(collection_id, plan_id, attempt_id, question_id)
    if claim.lease_token is None:
        return build_attempt_result(await store.attempt(collection_id, plan_id, attempt_id), config)
    lease = claim.lease_token
    if len(text) > config.short_answer_max_chars:  # the cap was lowered after submission
        await store.finish_short_answer(attempt_id, question_id, lease, unavailable_reason="invalid_output")
        raise QuizError("quiz_answer_invalid")
    context = await store.short_context(attempt_id, question_id, lease)  # read before charging

    async def charge():
        return (await store.charge_grading(attempt_id, question_id, lease, config.gradings_per_day)).model_dump()

    async def work(ledger: ProviderLedger):
        return await grade_short_answer(model, config, context, ledger)

    async def finish(result):
        payload, use = result
        await store.finish_short_answer(attempt_id, question_id, lease, feedback=payload, model=use.model)

    async def fail(error, refund: bool):
        reason = unavailable_reason(error)
        if reason is not None:
            await store.finish_short_answer(attempt_id, question_id, lease, unavailable_reason=reason, refund=refund)

    try:
        await metered_call(charge, work, finish, fail)
    except QuizLimitReached as reached:
        raise limit_error("quiz_grading_limit_reached", reached) from reached
    except ShortAnswerUnavailable:
        pass  # recorded by fail(); the answer reads back as unavailable with HTTP 200
    return build_attempt_result(await store.attempt(collection_id, plan_id, attempt_id), config)
