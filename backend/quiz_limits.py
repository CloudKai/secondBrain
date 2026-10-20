"""Quiz limits, configuration and the single metered-call ordering. Standard library only.

`load_quiz_config` is the ONLY reader of QUIZ_* variables and the only place a
model id is chosen. `metered_call` is the only implementation of
charge -> provider work -> finish/fail, shared by generation and short-answer
grading.
"""

import asyncio
import logging
import os
import re
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from backend.quiz_rules import classify_outcome

logger = logging.getLogger(__name__)
MODEL_ID = re.compile(r"^[A-Za-z0-9._:-]{1,64}$")
_INTEGER = re.compile(r"^[+-]?\d+$")
_TRUE = frozenset({"1", "true", "yes", "on"})
_FALSE = frozenset({"0", "false", "no", "off"})
EFFORTS = ("low", "medium", "high")

# name -> (default, floor, hard max)
_INTEGERS = {
    "QUIZ_MAX_QUESTIONS": (8, 4, 10),
    "QUIZ_MAX_SHORT_ANSWER": (2, 0, 2),
    "QUIZ_GENERATIONS_PER_USER_PER_DAY": (3, 1, 20),
    "QUIZ_GRADINGS_PER_USER_PER_DAY": (20, 1, 100),
    "QUIZ_MAX_OUTPUT_TOKENS": (4000, 1000, 8000),
    "QUIZ_GRADING_MAX_OUTPUT_TOKENS": (800, 200, 2000),
    "QUIZ_SHORT_ANSWER_MAX_CHARS": (1500, 100, 5000),
}
_MODELS = {
    "QUIZ_GENERATION_MODEL": "gpt-6-luna",
    "QUIZ_FALLBACK_MODEL": "gpt-6.1-sol",
    "QUIZ_GRADING_MODEL": "gpt-6-luna",
}
DEFAULT_ENABLED = True
DEFAULT_REASONING_EFFORT = "low"
TOKENS_PER_QUESTION = 350


@dataclass(frozen=True)
class QuizConfig:
    enabled: bool = DEFAULT_ENABLED
    max_questions: int = 8
    max_short_answer: int = 2
    generations_per_day: int = 3
    gradings_per_day: int = 20
    max_output_tokens: int = 4000
    grading_max_output_tokens: int = 800
    short_answer_max_chars: int = 1500
    generation_model: str = "gpt-6-luna"
    fallback_model: str = "gpt-6.1-sol"
    grading_model: str = "gpt-6-luna"
    reasoning_effort: str = DEFAULT_REASONING_EFFORT


def load_quiz_config(env: Mapping[str, str]) -> QuizConfig:
    """Parse QUIZ_* variables. Never raises; one warning per bad variable (name only)."""
    warned: set[str] = set()

    def warn(name: str, what: str) -> None:
        if name not in warned:
            warned.add(name)
            logger.warning("Quiz setting %s %s; using a safe value.", name, what)

    def raw(name: str) -> str | None:
        value = (env.get(name) or "").strip()
        return value or None

    def integer(name: str) -> int:
        default, floor, ceiling = _INTEGERS[name]
        text = raw(name)
        if text is None:
            return default
        if not _INTEGER.match(text):
            warn(name, "is not a whole number")
            return default
        value = int(text)
        if not floor <= value <= ceiling:
            warn(name, f"is outside {floor}-{ceiling}")
            return min(max(value, floor), ceiling)
        return value

    def model(name: str) -> str:
        text = raw(name)
        if text is None:
            return _MODELS[name]
        if not MODEL_ID.match(text):
            warn(name, "is not a valid model id")
            return _MODELS[name]
        return text

    enabled = DEFAULT_ENABLED
    text = raw("QUIZ_ENABLED")
    if text is not None:
        if text.lower() in _TRUE:
            enabled = True
        elif text.lower() in _FALSE:
            enabled = False
        else:
            enabled = False  # a spend switch fails closed
            warn("QUIZ_ENABLED", "is not true or false")
    effort = DEFAULT_REASONING_EFFORT
    text = raw("QUIZ_REASONING_EFFORT")
    if text is not None:
        if text.lower() in EFFORTS:
            effort = text.lower()
        else:
            warn("QUIZ_REASONING_EFFORT", "is not low, medium or high")
    config = QuizConfig(
        enabled=enabled,
        max_questions=integer("QUIZ_MAX_QUESTIONS"),
        max_short_answer=integer("QUIZ_MAX_SHORT_ANSWER"),
        generations_per_day=integer("QUIZ_GENERATIONS_PER_USER_PER_DAY"),
        gradings_per_day=integer("QUIZ_GRADINGS_PER_USER_PER_DAY"),
        max_output_tokens=integer("QUIZ_MAX_OUTPUT_TOKENS"),
        grading_max_output_tokens=integer("QUIZ_GRADING_MAX_OUTPUT_TOKENS"),
        short_answer_max_chars=integer("QUIZ_SHORT_ANSWER_MAX_CHARS"),
        generation_model=model("QUIZ_GENERATION_MODEL"),
        fallback_model=model("QUIZ_FALLBACK_MODEL"),
        grading_model=model("QUIZ_GRADING_MODEL"),
        reasoning_effort=effort,
    )
    if config.max_output_tokens < TOKENS_PER_QUESTION * config.max_questions:
        logger.warning(
            "QUIZ_MAX_OUTPUT_TOKENS is below %s x QUIZ_MAX_QUESTIONS; raise it to at least 6000 above 8 questions.",
            TOKENS_PER_QUESTION,
        )
    return config


_cached: QuizConfig | None = None


def get_quiz_config() -> QuizConfig:
    """Process-wide config; tests override this dependency or call reset_quiz_config."""
    global _cached
    if _cached is None:
        _cached = load_quiz_config(os.environ)
    return _cached


def reset_quiz_config() -> None:
    global _cached
    _cached = None


# --- UTC day ----------------------------------------------------------------------


def next_utc_midnight(now: datetime | None = None) -> datetime:
    current = (now or datetime.now(UTC)).astimezone(UTC)
    return datetime(current.year, current.month, current.day, tzinfo=UTC) + timedelta(days=1)


def iso_utc(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def seconds_until(moment: datetime, now: datetime | None = None) -> int:
    """Whole seconds until `moment`, at least 1 (for Retry-After)."""
    delta = moment - (now or datetime.now(UTC))
    return max(1, int(delta.total_seconds() + 0.999))


# --- ledger and metered call ------------------------------------------------------


class QuizLimitReached(Exception):
    def __init__(self, limit: int, used: int, resets_at: Any):
        super().__init__("quiz_limit_reached")
        self.limit = limit
        self.used = used
        self.resets_at = resets_at


class ProviderLedger:
    """Counts provider calls that started and the ones provably unspent."""

    def __init__(self) -> None:
        self.calls_started = 0
        self.calls_unspent = 0

    def begin(self) -> None:
        """Record immediately BEFORE the HTTP request is sent."""
        self.calls_started += 1

    def unspent(self) -> None:
        self.calls_unspent += 1

    def settle(self, kind: str, status: int | None = None, error_type: str | None = None) -> str:
        """Classify the outcome of a started call and record it."""
        outcome = classify_outcome(kind, status, error_type)
        if outcome == "unspent":
            self.unspent()
        return outcome

    @property
    def refundable(self) -> bool:
        return self.calls_started == self.calls_unspent


async def _release(fail: Callable[..., Awaitable[Any]], error: Any, refund: bool) -> None:
    """Run `fail` so that cancellation cannot interrupt it; its own errors are swallowed."""
    task = asyncio.ensure_future(fail(error, refund))
    try:
        await asyncio.shield(task)
    except asyncio.CancelledError:
        if task.done() and not task.cancelled():
            task.exception()  # retrieve so the loop does not log it
        raise
    except Exception as exc:  # noqa: BLE001 - the lease expiry is the backstop
        logger.warning("Quiz cleanup failed: %s", type(exc).__name__)


async def metered_call(
    charge: Callable[[], Awaitable[Mapping]],
    work: Callable[[ProviderLedger], Awaitable[Any]],
    finish: Callable[[Any], Awaitable[Any]],
    fail: Callable[[Any, bool], Awaitable[Any]],
) -> Any:
    """charge -> work(ledger) -> finish(result), or fail(error, refund).

    * A denied charge calls `fail("limit", False)` and raises QuizLimitReached; the
      provider is never called. A charge that raises fails closed (best-effort
      `fail`, then the error propagates).
    * `refund` is `ledger.refundable`; an error after a completed call never refunds.
    * Cleanup is shielded, so cancellation still releases the lease; the charge
      stands unless every started call was provably unspent.
    """
    ledger = ProviderLedger()
    try:
        grant = await charge()
    except BaseException as exc:
        await _release(fail, exc, False)
        raise
    if not isinstance(grant, Mapping) or grant.get("allowed") is not True:
        grant = grant if isinstance(grant, Mapping) else {}
        await _release(fail, "limit", False)
        raise QuizLimitReached(int(grant.get("limit") or 0), int(grant.get("used") or 0), grant.get("resets_at"))
    try:
        result = await work(ledger)
    except BaseException as exc:
        await _release(fail, exc, ledger.refundable)
        raise
    try:
        await finish(result)
    except BaseException as exc:
        await _release(fail, exc, False)
        raise
    return result
