"""Native tests (standard library only) for backend/quiz/grading.py."""

import itertools
import json
import unittest
from pathlib import Path

from backend.quiz.grading import (
    grade_choice,
    outcome_label,
    short_answer_result,
    signal_for,
    summarize_attempt,
)

CASES = json.loads((Path(__file__).parent / "fixtures" / "quiz_cases.json").read_text(encoding="utf-8"))
OPTIONS = ["o1", "o2", "o3", "o4", "o5"]


class ChoiceGradingTests(unittest.TestCase):
    def test_single_choice_and_true_false(self):
        for kind, key, wrong in (("single_choice", "o2", "o3"), ("true_false", "false", "true")):
            self.assertEqual(grade_choice(kind, [key], [key]), "correct")
            self.assertEqual(grade_choice(kind, [key], [wrong]), "incorrect")
            self.assertEqual(grade_choice(kind, [key], []), "unanswered")
            self.assertEqual(grade_choice(kind, [key], [key, key]), "correct")

    def test_multi_select_all_subsets_for_keys_of_two_and_three(self):
        for key in (["o1", "o3"], ["o2", "o4", "o5"]):
            for size in range(len(OPTIONS) + 1):
                for subset in itertools.combinations(OPTIONS, size):
                    if not subset:
                        expected = "unanswered"
                    elif set(subset) == set(key):
                        expected = "correct"
                    elif set(subset) < set(key):
                        expected = "partly_correct"
                    else:
                        expected = "incorrect"
                    self.assertEqual(grade_choice("multi_select", key, subset), expected, (key, subset))

    def test_there_are_32_subsets_per_key(self):
        self.assertEqual(sum(1 for size in range(6) for _ in itertools.combinations(OPTIONS, size)), 32)

    def test_option_sets_ignore_order_and_duplicates(self):
        self.assertEqual(grade_choice("multi_select", ["o1", "o3"], ["o3", "o1", "o1"]), "correct")
        self.assertEqual(grade_choice("multi_select", ["o3", "o1", "o3"], ["o1", "o3"]), "correct")

    def test_a_short_answer_is_not_a_choice_question(self):
        with self.assertRaises(ValueError):
            grade_choice("short_answer", [], [])


class SignalTests(unittest.TestCase):
    def test_signals(self):
        for result in ("correct", "addressed"):
            self.assertEqual(signal_for(result), "positive")
        for result in ("incorrect", "partly_correct", "unanswered", "needs_review"):
            self.assertEqual(signal_for(result), "negative")
        for result in ("uncertain", "unavailable", None, "pending"):
            self.assertEqual(signal_for(result), "neutral")


class ShortAnswerTests(unittest.TestCase):
    def test_golden_short_answer_cases(self):
        for case in CASES["short_answer_cases"]:
            result = short_answer_result(case["assessments"], blank=case.get("blank", False), unavailable=case.get("unavailable", False))
            self.assertEqual(result, (case["result"], case["signal"]), case["name"])

    def test_blank_wins_and_needs_no_assessment(self):
        self.assertEqual(short_answer_result([], blank=True), ("unanswered", "negative"))
        self.assertEqual(short_answer_result(["addressed"], blank=True), ("unanswered", "negative"))

    def test_invalid_input_is_rejected(self):
        with self.assertRaises(ValueError):
            short_answer_result([])
        with self.assertRaises(ValueError):
            short_answer_result(["addressed", "great"])

    def test_every_assessment_combination(self):
        for size in (2, 3, 4):
            for combo in itertools.product(("addressed", "try_again", "uncertain"), repeat=size):
                result, signal = short_answer_result(combo)
                if "try_again" in combo:
                    self.assertEqual((result, signal), ("needs_review", "negative"), combo)
                elif "uncertain" in combo:
                    self.assertEqual((result, signal), ("uncertain", "neutral"), combo)
                else:
                    self.assertEqual((result, signal), ("addressed", "positive"), combo)


def questions_for(case):
    rows = [{"kind": "single_choice", "outcome_index": 0, "result": r} for r in case["deterministic"]]
    for r in case["short"]:
        rows.append({"kind": "short_answer", "outcome_index": 0, "result": None if r == "pending" else r})
    return rows


class OutcomeLabelTests(unittest.TestCase):
    OUTCOMES = [{"index": 0, "title": "One"}]

    def test_golden_outcome_cases(self):
        self.assertGreaterEqual(len(CASES["outcome_cases"]), 11)
        for case in CASES["outcome_cases"]:
            outcome = summarize_attempt(questions_for(case), self.OUTCOMES)["outcomes"][0]
            expected = case["expected"]
            self.assertEqual({k: outcome[k] for k in expected}, expected, case["name"])

    def test_blank_short_answer_is_worth_reviewing_without_ai_attribution(self):
        outcome = summarize_attempt(questions_for({"deterministic": ["correct", "correct"], "short": ["unanswered"]}), self.OUTCOMES)["outcomes"][0]
        self.assertEqual((outcome["label"], outcome["short_blank"], outcome["short_needs_review"], outcome["ai_contributed"]),
                         ("worth_reviewing", 1, 0, False))

    def test_label_rule(self):
        self.assertEqual(outcome_label(2, 0, 0, 0), "looks_solid")
        self.assertEqual(outcome_label(5, 0, 0, 0), "looks_solid")
        self.assertEqual(outcome_label(1, 0, 0, 0), "worth_reviewing")
        self.assertEqual(outcome_label(2, 1, 0, 0), "worth_reviewing")
        self.assertEqual(outcome_label(2, 0, 1, 0), "worth_reviewing")
        self.assertEqual(outcome_label(2, 0, 0, 1), "worth_reviewing")

    def test_short_answers_can_only_demote(self):
        det_results = ["correct", "incorrect", "partly_correct", "unanswered"]
        short_results = [None, "addressed", "needs_review", "uncertain", "unavailable", "unanswered"]

        def label(det, short):
            case = {"deterministic": list(det), "short": [] if short == "none" else [short or "pending"]}
            return summarize_attempt(questions_for(case), self.OUTCOMES)["outcomes"][0]["label"]

        for size in (1, 2, 3, 4):
            for det in itertools.product(det_results, repeat=size):
                base = label(det, "none")
                for short in short_results:
                    result = label(det, short)
                    if base == "worth_reviewing":
                        self.assertEqual(result, "worth_reviewing", (det, short))
                    else:
                        demoted = short in ("needs_review", "unanswered")
                        self.assertEqual(result, "worth_reviewing" if demoted else "looks_solid", (det, short))


class SummaryTests(unittest.TestCase):
    OUTCOMES = [{"index": 0, "title": "A"}, {"index": 1, "title": "B"}, {"index": 2, "title": "C"}, {"index": 3, "title": "D"}]

    def test_score_counts_only_choice_questions(self):
        rows = [{"kind": "single_choice", "outcome_index": 0, "result": "correct"},
                {"kind": "true_false", "outcome_index": 0, "result": "incorrect"},
                {"kind": "multi_select", "outcome_index": 1, "result": "partly_correct"},
                {"kind": "short_answer", "outcome_index": 1, "result": "addressed"}]
        summary = summarize_attempt(rows, self.OUTCOMES[:2])
        self.assertEqual(summary["score"], {"correct": 1, "total": 3})
        self.assertEqual(summarize_attempt([{"kind": "single_choice", "outcome_index": 0, "result": "unanswered"}] * 3, self.OUTCOMES[:1])["score"], {"correct": 0, "total": 3})

    def test_short_answer_totals(self):
        rows = [{"kind": "short_answer", "outcome_index": 0, "result": None},
                {"kind": "short_answer", "outcome_index": 0, "result": "unavailable"},
                {"kind": "short_answer", "outcome_index": 1, "result": "uncertain"}]
        self.assertEqual(summarize_attempt(rows, self.OUTCOMES[:2])["short_answers"], {"total": 3, "pending": 1, "unavailable": 1})

    def test_review_first_is_ordered_by_count_then_index_and_capped_at_three(self):
        def rows(index, wrong):
            return [{"kind": "single_choice", "outcome_index": index, "result": "incorrect"} for _ in range(wrong)] + \
                   [{"kind": "single_choice", "outcome_index": index, "result": "correct"}] * 2
        data = rows(0, 1) + rows(1, 3) + rows(2, 3) + rows(3, 2)
        self.assertEqual(summarize_attempt(data, self.OUTCOMES)["review_first"], [1, 2, 3])
        solid = [{"kind": "single_choice", "outcome_index": 0, "result": "correct"}] * 2
        self.assertEqual(summarize_attempt(solid, self.OUTCOMES[:1])["review_first"], [])

    def test_short_answer_counts_feed_the_review_order(self):
        rows = [{"kind": "single_choice", "outcome_index": i, "result": "correct"} for i in (0, 0, 1, 1)]
        rows += [{"kind": "short_answer", "outcome_index": 1, "result": "needs_review"},
                 {"kind": "short_answer", "outcome_index": 0, "result": "unanswered"},
                 {"kind": "short_answer", "outcome_index": 0, "result": "unanswered"}]
        summary = summarize_attempt(rows, self.OUTCOMES[:2])
        self.assertEqual(summary["review_first"], [0, 1])
        self.assertEqual([o["ai_contributed"] for o in summary["outcomes"]], [False, True])

    def test_redacted_questions_keep_scores_and_labels(self):
        rows = [{"kind": "redacted", "original_kind": "single_choice", "outcome_index": 0, "result": "correct"},
                {"kind": "redacted", "original_kind": "true_false", "outcome_index": 0, "result": "correct"}]
        summary = summarize_attempt(rows, self.OUTCOMES[:1])
        self.assertEqual(summary["score"], {"correct": 2, "total": 2})
        self.assertEqual(summary["outcomes"][0]["label"], "looks_solid")


if __name__ == "__main__":
    unittest.main()
