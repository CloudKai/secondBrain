"""Native tests (standard library only) for backend/quiz/limits.py."""

import asyncio
import unittest
from datetime import UTC, datetime

from backend.quiz.limits import (
    ProviderLedger,
    QuizConfig,
    QuizLimitReached,
    get_quiz_config,
    iso_utc,
    load_quiz_config,
    metered_call,
    next_utc_midnight,
    reset_quiz_config,
    seconds_until,
)


class ConfigTests(unittest.TestCase):
    def test_defaults(self):
        config = load_quiz_config({})
        self.assertEqual(config, QuizConfig())
        self.assertEqual((config.max_questions, config.max_short_answer, config.generations_per_day, config.gradings_per_day), (8, 2, 3, 20))
        self.assertEqual((config.max_output_tokens, config.grading_max_output_tokens, config.short_answer_max_chars), (4000, 800, 1500))
        self.assertEqual((config.generation_model, config.fallback_model, config.grading_model), ("gpt-6-luna", "gpt-6.1-sol", "gpt-6-luna"))
        self.assertEqual((config.enabled, config.reasoning_effort), (True, "low"))

    def test_missing_empty_and_blank_use_the_default_without_a_warning(self):
        with self.assertNoLogs("backend.quiz.limits", "WARNING"):
            self.assertEqual(load_quiz_config({"QUIZ_MAX_QUESTIONS": "", "QUIZ_GRADING_MODEL": "  "}), QuizConfig())

    def test_garbage_falls_back_with_one_warning_naming_the_variable(self):
        for value in ("abc", "3.5", "1e3", "True", "--2"):
            with self.assertLogs("backend.quiz.limits", "WARNING") as logs:
                config = load_quiz_config({"QUIZ_MAX_QUESTIONS": value})
            self.assertEqual(config.max_questions, 8, value)
            self.assertEqual(len(logs.records), 1, value)
            self.assertIn("QUIZ_MAX_QUESTIONS", logs.output[0])
            self.assertNotIn(value, logs.output[0])

    def test_every_integer_variable_clamps_to_its_floor_and_hard_max(self):
        table = {
            "QUIZ_MAX_QUESTIONS": ("max_questions", 4, 10),
            "QUIZ_MAX_SHORT_ANSWER": ("max_short_answer", 0, 2),
            "QUIZ_GENERATIONS_PER_USER_PER_DAY": ("generations_per_day", 1, 20),
            "QUIZ_GRADINGS_PER_USER_PER_DAY": ("gradings_per_day", 1, 100),
            "QUIZ_MAX_OUTPUT_TOKENS": ("max_output_tokens", 1000, 8000),
            "QUIZ_GRADING_MAX_OUTPUT_TOKENS": ("grading_max_output_tokens", 200, 2000),
            "QUIZ_SHORT_ANSWER_MAX_CHARS": ("short_answer_max_chars", 100, 5000),
        }
        for name, (field, floor, ceiling) in table.items():
            for given, expected in ((str(floor - 1), floor), ("-5", floor), (str(ceiling + 1), ceiling), ("999999", ceiling)):
                with self.assertLogs("backend.quiz.limits", "WARNING") as logs:
                    config = load_quiz_config({name: given})
                self.assertEqual(getattr(config, field), expected, (name, given))
                self.assertTrue(any(name in line for line in logs.output), (name, given))
            for given in (str(floor), str(ceiling)):  # in range: used as given (other warnings may apply)
                self.assertEqual(getattr(load_quiz_config({name: given}), field), int(given), (name, given))

    def test_model_ids_are_checked_against_the_pattern(self):
        for bad in ("bad model", "a/b", "x" * 65, "モデル"):
            with self.assertLogs("backend.quiz.limits", "WARNING") as logs:
                config = load_quiz_config({"QUIZ_GENERATION_MODEL": bad, "QUIZ_FALLBACK_MODEL": bad, "QUIZ_GRADING_MODEL": bad})
            self.assertEqual((config.generation_model, config.fallback_model, config.grading_model), ("gpt-6-luna", "gpt-6.1-sol", "gpt-6-luna"))
            self.assertEqual(len(logs.records), 3)
        config = load_quiz_config({"QUIZ_GRADING_MODEL": "gpt-6.1-sol", "QUIZ_GENERATION_MODEL": "ft:model_1-a.b"})
        self.assertEqual((config.grading_model, config.generation_model), ("gpt-6.1-sol", "ft:model_1-a.b"))

    def test_enabled_parsing(self):
        for text in ("true", "TRUE", "1", "yes", "on", ""):
            self.assertTrue(load_quiz_config({"QUIZ_ENABLED": text}).enabled, text)
        for text in ("false", "False", "0", "no", "off"):
            self.assertFalse(load_quiz_config({"QUIZ_ENABLED": text}).enabled, text)
        with self.assertLogs("backend.quiz.limits", "WARNING"):
            self.assertFalse(load_quiz_config({"QUIZ_ENABLED": "maybe"}).enabled)

    def test_reasoning_effort(self):
        self.assertEqual(load_quiz_config({"QUIZ_REASONING_EFFORT": "High"}).reasoning_effort, "high")
        with self.assertLogs("backend.quiz.limits", "WARNING"):
            self.assertEqual(load_quiz_config({"QUIZ_REASONING_EFFORT": "extreme"}).reasoning_effort, "low")

    def test_small_token_cap_for_many_questions_logs_one_warning(self):
        with self.assertLogs("backend.quiz.limits", "WARNING") as logs:
            load_quiz_config({"QUIZ_MAX_QUESTIONS": "10", "QUIZ_MAX_OUTPUT_TOKENS": "3000"})
        self.assertEqual(len(logs.records), 1)
        self.assertIn("QUIZ_MAX_OUTPUT_TOKENS", logs.output[0])
        with self.assertNoLogs("backend.quiz.limits", "WARNING"):
            load_quiz_config({"QUIZ_MAX_QUESTIONS": "10", "QUIZ_MAX_OUTPUT_TOKENS": "6000"})
            load_quiz_config({})

    def test_the_cached_config_can_be_reset(self):
        reset_quiz_config()
        self.assertIs(get_quiz_config(), get_quiz_config())
        reset_quiz_config()


class UtcDayTests(unittest.TestCase):
    def test_next_midnight(self):
        now = datetime(2026, 10, 21, 9, 14, 3, tzinfo=UTC)
        self.assertEqual(iso_utc(next_utc_midnight(now)), "2026-10-22T00:00:00Z")
        self.assertEqual(iso_utc(next_utc_midnight(datetime(2026, 12, 31, 23, 59, 59, tzinfo=UTC))), "2027-01-01T00:00:00Z")
        self.assertEqual(iso_utc(next_utc_midnight(datetime(2026, 10, 21, 0, 0, 0, tzinfo=UTC))), "2026-10-22T00:00:00Z")

    def test_seconds_until(self):
        now = datetime(2026, 10, 21, 23, 0, 0, tzinfo=UTC)
        self.assertEqual(seconds_until(next_utc_midnight(now), now), 3600)
        self.assertEqual(seconds_until(now, now), 1)


class Events:
    """Records the order in which charge/work/finish/fail run."""

    def __init__(self, grant=None, work_error=None, finish_error=None, fail_error=None, calls=None):
        self.log = []
        self.grant = grant if grant is not None else {"allowed": True, "used": 1, "limit": 3, "resets_at": "2026-10-22T00:00:00Z"}
        self.work_error, self.finish_error, self.fail_error, self.calls = work_error, finish_error, fail_error, calls or []
        self.refunds = []
        self.ledger = None

    async def charge(self):
        self.log.append("charge")
        if isinstance(self.grant, BaseException):
            raise self.grant
        return self.grant

    async def work(self, ledger):
        self.log.append("work")
        self.ledger = ledger
        for kind, status, error_type in self.calls:
            ledger.begin()
            ledger.settle(kind, status, error_type)
        if self.work_error:
            raise self.work_error
        return "result"

    async def finish(self, result):
        self.log.append(("finish", result))
        if self.finish_error:
            raise self.finish_error

    async def fail(self, error, refund):
        self.log.append("fail")
        self.refunds.append((error, refund))
        if self.fail_error:
            raise self.fail_error

    async def run(self):
        return await metered_call(self.charge, self.work, self.finish, self.fail)


class LedgerTests(unittest.TestCase):
    def test_refundable_means_every_started_call_was_unspent(self):
        ledger = ProviderLedger()
        self.assertTrue(ledger.refundable)  # no call started
        ledger.begin()
        self.assertFalse(ledger.refundable)
        ledger.unspent()
        self.assertTrue(ledger.refundable)
        ledger.begin()
        self.assertFalse(ledger.refundable)

    def test_settle_classifies(self):
        ledger = ProviderLedger()
        for kind, status, error_type in (("ConnectError", None, None), ("http", 401, None)):
            ledger.begin()
            self.assertEqual(ledger.settle(kind, status, error_type), "unspent")
        self.assertTrue(ledger.refundable)
        ledger.begin()
        self.assertEqual(ledger.settle("ReadTimeout"), "spent")
        self.assertFalse(ledger.refundable)


class MeteredCallTests(unittest.TestCase):
    def test_success_orders_charge_work_finish_and_never_refunds(self):
        events = Events(calls=[("http", 200, None)])
        self.assertEqual(asyncio.run(events.run()), "result")
        self.assertEqual(events.log, ["charge", "work", ("finish", "result")])
        self.assertEqual(events.refunds, [])

    def test_denied_charge_never_calls_work(self):
        events = Events(grant={"allowed": False, "used": 3, "limit": 3, "resets_at": "2026-10-22T00:00:00Z"})
        with self.assertRaises(QuizLimitReached) as caught:
            asyncio.run(events.run())
        self.assertEqual(events.log, ["charge", "fail"])
        self.assertEqual(events.refunds, [("limit", False)])
        self.assertEqual((caught.exception.limit, caught.exception.used, caught.exception.resets_at), (3, 3, "2026-10-22T00:00:00Z"))

    def test_malformed_grant_is_a_denial(self):
        for grant in ({}, {"allowed": "yes"}, {"allowed": 1}):
            events = Events(grant=grant)
            with self.assertRaises(QuizLimitReached):
                asyncio.run(events.run())
            self.assertEqual(events.log, ["charge", "fail"])

    def test_a_charge_that_raises_fails_closed(self):
        events = Events(grant=RuntimeError("storage down"))
        with self.assertRaises(RuntimeError):
            asyncio.run(events.run())
        self.assertEqual(events.log, ["charge", "fail"])
        self.assertEqual(events.refunds[0][1], False)

    def refund_for(self, calls, error=None):
        events = Events(calls=calls, work_error=error or RuntimeError("provider"))
        with self.assertRaises(Exception):
            asyncio.run(events.run())
        self.assertEqual(events.log, ["charge", "work", "fail"])
        return events.refunds[0][1]

    def test_one_case_per_spec_row(self):
        self.assertTrue(self.refund_for([]), "no call started (missing key)")
        self.assertTrue(self.refund_for([("not_started", None, None)]))
        self.assertTrue(self.refund_for([("ConnectError", None, None)]))
        self.assertTrue(self.refund_for([("ConnectTimeout", None, None)]))
        for status in (400, 401, 403, 404):
            self.assertTrue(self.refund_for([("http", status, None)]), status)
        self.assertTrue(self.refund_for([("http", 429, "invalid_request_error")]))
        self.assertTrue(self.refund_for([("http", 429, "insufficient_quota")]))
        for name in ("ReadTimeout", "WriteTimeout", "PoolTimeout", "TimeoutError", "RemoteProtocolError", "ReadError"):
            self.assertFalse(self.refund_for([(name, None, None)]), name)
        for status in (422, 429, 500, 502, 503):
            self.assertFalse(self.refund_for([("http", status, None)]), status)
        self.assertFalse(self.refund_for([("http", 429, "rate_limit_exceeded")]))
        for status in (200, 201):
            self.assertFalse(self.refund_for([("http", status, None)]), status)

    def test_mixed_ladder_is_not_refundable(self):
        self.assertFalse(self.refund_for([("http", 200, None), ("http", 401, None)]))
        self.assertFalse(self.refund_for([("http", 401, None), ("ReadTimeout", None, None)]))

    def test_cancellation_mid_call_still_awaits_fail_and_never_refunds(self):
        events = Events(calls=[], work_error=asyncio.CancelledError())

        async def cancelled(ledger):
            events.log.append("work")
            ledger.begin()
            raise asyncio.CancelledError()

        with self.assertRaises(asyncio.CancelledError):
            asyncio.run(metered_call(events.charge, cancelled, events.finish, events.fail))
        self.assertEqual(events.log, ["charge", "work", "fail"])
        self.assertEqual(events.refunds[0][1], False)

    def test_a_real_task_cancel_still_runs_the_cleanup(self):
        async def scenario():
            events = Events()
            started = asyncio.Event()

            async def slow(ledger):
                ledger.begin()
                started.set()
                await asyncio.sleep(30)

            task = asyncio.ensure_future(metered_call(events.charge, slow, events.finish, events.fail))
            await started.wait()
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
            return events

        events = asyncio.run(scenario())
        self.assertEqual(events.log, ["charge", "fail"])
        self.assertEqual(events.refunds[0][1], False)

    def test_finish_raising_after_a_completed_call_does_not_refund(self):
        events = Events(calls=[("http", 200, None)], finish_error=RuntimeError("storage"))
        with self.assertRaises(RuntimeError):
            asyncio.run(events.run())
        self.assertEqual(events.log, ["charge", "work", ("finish", "result"), "fail"])
        self.assertEqual(events.refunds[0][1], False)

    def test_a_failing_cleanup_is_swallowed_and_the_original_error_wins(self):
        events = Events(calls=[("ConnectError", None, None)], work_error=ValueError("original"), fail_error=RuntimeError("cleanup"))
        with self.assertRaises(ValueError):
            asyncio.run(events.run())
        events = Events(grant={"allowed": False, "limit": 3, "used": 3}, fail_error=RuntimeError("cleanup"))
        with self.assertRaises(QuizLimitReached):
            asyncio.run(events.run())

    def test_the_error_is_passed_to_fail(self):
        error = ValueError("original")
        events = Events(work_error=error)
        with self.assertRaises(ValueError):
            asyncio.run(events.run())
        self.assertIs(events.refunds[0][0], error)


if __name__ == "__main__":
    unittest.main()
