"""Native tests (standard library only) for backend/quiz/rules.py."""

import copy
import json
import unittest
from pathlib import Path

from backend.quiz.rules import (
    canonical_answers_hash,
    check_generated,
    cited_ids,
    classify_outcome,
    normalize_answer_text,
    overlap_ok,
    quiz_shape,
    refundable_error_type,
)

FIXTURES = Path(__file__).parent / "fixtures"
CASES = json.loads((FIXTURES / "quiz_cases.json").read_text(encoding="utf-8"))
STORED = json.loads((FIXTURES / "quiz_stored_example.json").read_text(encoding="utf-8"))

EXCERPTS = {
    "p0001": "A source provides evidence for a claim and the claim stands only when the cited passage backs it.",
    "p0002": "Similarity by itself does not establish support; compare the wording of the claim with the passage.",
    "p0003": "Learners can revisit original evidence when checking a conclusion against its source.",
    "p0004": "The original source remains useful after a conclusion is written because the conclusion is checked against it.",
}


def option(text, correct=False):
    return {"text": text, "is_correct": correct}


def det(lesson, kind="single_choice", citation="p0001", prompt=None, correct_text=None):
    n = lesson * 10 + len(prompt or "")
    if kind == "true_false":
        return {"kind": kind, "lesson_index": lesson, "prompt": prompt or f"Similarity by itself does not establish support {n}",
                "options": [option("True"), option("False", True)], "explanation": "Compare the claim with the passage.",
                "citation_ids": [citation], "criteria": [], "model_answer": None}
    right = correct_text or "The cited passage backs the specific claim"
    return {"kind": kind, "lesson_index": lesson, "prompt": prompt or f"Which statement describes support number {n}?",
            "options": [option(right, True), option("It sounds familiar"), option("Many sources repeat it"), option("Nobody disagrees")],
            "explanation": "The passage backs the claim.", "citation_ids": [citation], "criteria": [], "model_answer": None}


def short(lesson, citation="p0003"):
    return {"kind": "short_answer", "lesson_index": lesson, "prompt": f"Explain how to check a conclusion in lesson {lesson}",
            "options": [], "explanation": "Return to the original passage.", "citation_ids": [citation],
            "criteria": ["Mentions the original passage", "Mentions comparing it with the conclusion"],
            "model_answer": "Return to the original evidence and compare it with the conclusion"}


def valid_quiz():
    return {"questions": [
        det(0, prompt="Which statement describes support for lesson zero?"),
        det(0, "true_false"),
        det(0, correct_text="Compare the wording of the claim with the passage", citation="p0002", prompt="Which check helps compare a claim?"),
        det(1, citation="p0003", correct_text="Revisit original evidence when checking a conclusion", prompt="What should a learner revisit?"),
        det(1, "true_false", citation="p0004", prompt="The original source remains useful after a conclusion is written"),
        short(1),
    ]}


CITED = {0: ["p0001", "p0002"], 1: ["p0003", "p0004"]}
SHAPE = quiz_shape(6, 1, [0, 1])


def reasons(quiz, shape=SHAPE):
    return check_generated(quiz, EXCERPTS, CITED, shape)


class ClassifyOutcomeTests(unittest.TestCase):
    """One case per row of the spec 7.3 table."""

    def test_no_request_sent_is_unspent(self):
        self.assertEqual(classify_outcome("not_started"), "unspent")

    def test_connect_errors_are_unspent(self):
        self.assertEqual(classify_outcome("ConnectError"), "unspent")
        self.assertEqual(classify_outcome("ConnectTimeout"), "unspent")

    def test_rejected_before_processing_is_unspent(self):
        for status in (400, 401, 403, 404):
            self.assertEqual(classify_outcome("http", status), "unspent", status)

    def test_owner_caused_429_is_unspent(self):
        self.assertEqual(classify_outcome("http", 429, "invalid_request_error"), "unspent")
        self.assertEqual(classify_outcome("http", 429, "insufficient_quota"), "unspent")

    def test_other_429_is_spent(self):
        self.assertEqual(classify_outcome("http", 429, "rate_limit_exceeded"), "spent")
        self.assertEqual(classify_outcome("http", 429), "spent")
        self.assertEqual(classify_outcome("http", 429, None), "spent")

    def test_timeouts_are_spent_and_connect_timeout_is_not_confused_with_them(self):
        for name in ("ReadTimeout", "WriteTimeout", "PoolTimeout", "TimeoutException", "TimeoutError"):
            self.assertEqual(classify_outcome(name), "spent", name)
        self.assertEqual(classify_outcome("ConnectTimeout"), "unspent")

    def test_cancellation_and_network_errors_are_spent(self):
        for name in ("CancelledError", "RemoteProtocolError", "ReadError", "SomethingElse"):
            self.assertEqual(classify_outcome(name), "spent", name)

    def test_server_errors_422_and_success_are_spent(self):
        for status in (422, 500, 502, 503, 200, 201):
            self.assertEqual(classify_outcome("http", status), "spent", status)
        self.assertEqual(classify_outcome("http", None), "spent")

    def test_error_type_comes_from_type_or_code(self):
        self.assertEqual(refundable_error_type({"error": {"type": "insufficient_quota"}}), "insufficient_quota")
        self.assertEqual(refundable_error_type({"error": {"type": "requests", "code": "invalid_request_error"}}), "invalid_request_error")
        self.assertEqual(refundable_error_type({"error": {"code": "rate_limit_exceeded"}}), "rate_limit_exceeded")
        for body in (None, [], {}, {"error": "text"}, {"error": {}}, {"error": {"type": 3}}):
            self.assertIsNone(refundable_error_type(body))


class CitedIdsTests(unittest.TestCase):
    LESSON = {
        "explanation": {"citation_ids": ["p0001", "p0002"]},
        "check": {"worked_answer": {"citation_ids": ["p0002", "p0003", "p0099"]}},
        "example": {"provenance": "source_backed", "citation_ids": ["p0004"]},
    }

    def test_union_in_first_seen_order_without_duplicates_or_unknown_ids(self):
        self.assertEqual(cited_ids(self.LESSON, ["p0001", "p0002", "p0003", "p0004"]), ["p0001", "p0002", "p0003", "p0004"])

    def test_unknown_ids_are_dropped(self):
        self.assertEqual(cited_ids(self.LESSON, ["p0002", "p0004"]), ["p0002", "p0004"])

    def test_generated_examples_contribute_nothing(self):
        lesson = copy.deepcopy(self.LESSON)
        lesson["example"] = {"provenance": "generated_example", "citation_ids": []}
        self.assertEqual(cited_ids(lesson, ["p0001", "p0002", "p0003", "p0004"]), ["p0001", "p0002", "p0003"])

    def test_missing_example_and_sparse_lessons(self):
        self.assertEqual(cited_ids({"explanation": {"citation_ids": ["p0001"]}, "example": None}, ["p0001"]), ["p0001"])
        self.assertEqual(cited_ids({}, ["p0001"]), [])


class QuizShapeTests(unittest.TestCase):
    def test_table_for_four_lessons(self):
        expected = {4: (0, 2, 4, 4, 4), 5: (1, 2, 4, 5, 5), 6: (2, 2, 4, 5, 6), 7: (2, 2, 4, 5, 7),
                    8: (2, 3, 6, 7, 8), 9: (2, 3, 6, 7, 9), 10: (2, 4, 8, 9, 10)}
        for max_q, (short_max, l_cov, det_min, total_min, total_max) in expected.items():
            shape = quiz_shape(max_q, 2, [0, 1, 2, 3])
            self.assertEqual((shape.short_max, shape.l_cov, shape.det_min, shape.total_min, shape.total_max),
                             (short_max, l_cov, det_min, total_min, total_max), max_q)

    def test_every_row_is_feasible(self):
        for max_q in range(4, 11):
            for lessons in range(1, 5):
                shape = quiz_shape(max_q, 2, list(range(lessons)))
                self.assertTrue(shape.feasible, (max_q, lessons))

    def test_final_lesson_is_always_covered(self):
        self.assertEqual(quiz_shape(8, 2, [0, 1, 2, 3]).covered, (0, 1, 3))
        self.assertEqual(quiz_shape(6, 2, [0, 1, 2, 3]).covered, (0, 3))
        self.assertEqual(quiz_shape(10, 2, [0, 1, 2, 3]).covered, (0, 1, 2, 3))
        self.assertEqual(quiz_shape(8, 2, [0, 1, 2]).covered, (0, 1, 2))
        self.assertEqual(quiz_shape(8, 2, [5]).covered, (5,))

    def test_single_lesson_covers_it_with_three_to_four_choice_questions(self):
        shape = quiz_shape(8, 2, [2])
        self.assertEqual((shape.covered, shape.det_min, shape.short_min, shape.short_max), ((2,), 3, 1, 2))

    def test_short_answers_follow_the_configured_maximum(self):
        self.assertEqual(quiz_shape(8, 0, [0, 1]).short_max, 0)
        self.assertEqual(quiz_shape(8, 0, [0, 1]).short_min, 0)
        self.assertEqual(quiz_shape(8, 9, [0, 1]).short_max, 2)

    def test_no_quizzable_lessons(self):
        self.assertEqual(quiz_shape(8, 2, []).covered, ())


class CheckGeneratedTests(unittest.TestCase):
    def test_a_valid_quiz_has_no_reasons(self):
        self.assertEqual(reasons(valid_quiz()), [])

    def mutated(self, change):
        quiz = valid_quiz()
        change(quiz["questions"])
        return reasons(quiz)

    def assertRule(self, found, rule):
        self.assertTrue(any(r.startswith(rule + ":") for r in found), (rule, found))

    def test_v2_counts(self):
        self.assertRule(self.mutated(lambda q: q.pop()), "V2")
        self.assertRule(self.mutated(lambda q: q.extend([copy.deepcopy(q[0]) for _ in range(3)])), "V2")
        self.assertRule(reasons(valid_quiz(), quiz_shape(8, 0, [0, 1])), "V2")

    def test_v3_lesson_must_be_covered(self):
        self.assertRule(self.mutated(lambda q: q[0].update(lesson_index=7)), "V3")

    def test_v4_option_shapes(self):
        self.assertRule(self.mutated(lambda q: q[0]["options"].pop()), "V4")
        self.assertRule(self.mutated(lambda q: q[0]["options"][1].update(is_correct=True)), "V9")
        self.assertRule(self.mutated(lambda q: q[1]["options"][0].update(text="Yes")), "V4")
        self.assertRule(self.mutated(lambda q: q[1]["options"].__setitem__(slice(None), [option("True", True), option("False", True)])), "V4")
        self.assertRule(self.mutated(lambda q: q[2]["options"].append(option("Extra"))), "V4")
        self.assertRule(self.mutated(lambda q: q[5].update(options=[option("x")])), "V4")

    def test_multi_select_needs_two_or_three_correct(self):
        multi = det(0, "multi_select", citation="p0001", prompt="Select all that apply to support")
        multi["options"] = [option("The cited passage backs the claim", True)] + [option(f"Other idea {i}") for i in range(4)]
        quiz = valid_quiz()
        quiz["questions"][2] = multi
        self.assertRule(reasons(quiz), "V4")
        multi["options"][1]["is_correct"] = True
        multi["options"][1]["text"] = "Compare the wording of the claim with the passage"
        self.assertEqual(reasons(quiz), [])
        for item in multi["options"][2:4]:
            item["is_correct"] = True
        self.assertRule(reasons(quiz), "V4")

    def test_v5_text_hygiene(self):
        self.assertRule(self.mutated(lambda q: q[0].update(prompt=" padded ")), "V5")
        self.assertRule(self.mutated(lambda q: q[0]["options"][1].update(text="   ")), "V5")
        self.assertRule(self.mutated(lambda q: q[0]["options"][2].update(text="it sounds FAMILIAR")), "V5")
        self.assertRule(self.mutated(lambda q: q[3].update(prompt=q[0]["prompt"].upper())), "V5")
        self.assertRule(self.mutated(lambda q: q[0]["options"][3].update(text="None of the above")), "V5")
        self.assertRule(self.mutated(lambda q: q[0]["options"][3].update(text="Both a and c")), "V5")
        self.assertRule(self.mutated(lambda q: q[0].update(explanation="See p0003 for the answer")), "V5")
        self.assertRule(self.mutated(lambda q: q[0].update(prompt="According to source2, what is support?")), "V5")

    def test_v6_choice_questions_per_covered_lesson(self):
        self.assertRule(self.mutated(lambda q: q.__setitem__(4, short(1, citation="p0004"))), "V6")
        self.assertRule(self.mutated(lambda q: q.__setitem__(1, det(0, prompt="Another prompt about support?")) or q.append(det(0, prompt="Third about support?")) or q.append(det(0, prompt="Fourth about support?")) or q.append(det(0, prompt="Fifth about support?"))), "V6")

    def test_v7_citations(self):
        self.assertRule(self.mutated(lambda q: q[0].update(citation_ids=[])), "V7")
        self.assertRule(self.mutated(lambda q: q[0].update(citation_ids=["p0001", "p0002", "p0001", "p0002"])), "V7")
        self.assertRule(self.mutated(lambda q: q[0].update(citation_ids=["p0001", "p0001"])), "V7")
        self.assertRule(self.mutated(lambda q: q[0].update(citation_ids=["p0009"])), "V7")
        self.assertRule(self.mutated(lambda q: q[0].update(citation_ids=["p0003"])), "V7")

    def test_v8_short_answer_fields(self):
        self.assertRule(self.mutated(lambda q: q[5].update(criteria=["only one"])), "V8")
        self.assertRule(self.mutated(lambda q: q[5].update(model_answer=None)), "V8")
        self.assertRule(self.mutated(lambda q: q[0].update(criteria=["x"])), "V8")
        self.assertRule(self.mutated(lambda q: q[0].update(model_answer="x")), "V8")

    def test_v10_overlap_guard_names_the_rule_not_the_text(self):
        found = self.mutated(lambda q: q[0]["options"][0].update(text="Photosynthesis converts sunlight into chemical energy"))
        self.assertRule(found, "V10")
        self.assertFalse(any("Photosynthesis" in r for r in found))
        self.assertRule(self.mutated(lambda q: q[1].update(prompt="Volcanoes erupt molten magma regularly")), "V10")
        self.assertRule(self.mutated(lambda q: q[5].update(model_answer="Volcanoes erupt molten magma regularly")), "V10")

    def test_stored_example_prompts_are_valid_choice_shapes(self):
        kinds = [q["kind"] for q in STORED["questions"]]
        self.assertEqual(sorted(set(kinds)), ["multi_select", "short_answer", "single_choice", "true_false"])


class OverlapCaseTests(unittest.TestCase):
    def test_golden_overlap_cases(self):
        self.assertGreaterEqual(len(CASES["overlap_cases"]), 8)
        for case in CASES["overlap_cases"]:
            self.assertEqual(overlap_ok(case["text"], case["excerpts"]), case["pass"], case["name"])


class AnswerTextTests(unittest.TestCase):
    def test_normalisation(self):
        self.assertEqual(normalize_answer_text("e\u0301"), "\u00e9")
        self.assertEqual(normalize_answer_text("a\r\nb\rc"), "a\nb\nc")
        self.assertEqual(normalize_answer_text("a\u2028b\u2029c"), "a\nb\nc")
        self.assertEqual(normalize_answer_text("a\x00b\x07c\u200bd\te"), "abcd\te")
        family = "\U0001F468\u200d\U0001F469\u200d\U0001F467"
        self.assertEqual(normalize_answer_text(family), family)
        self.assertEqual(normalize_answer_text("\u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u0645"), "\u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u0645")
        self.assertEqual(normalize_answer_text("  \n\t "), "")
        self.assertEqual(normalize_answer_text("  hi  "), "hi")

    def test_cap_counts_code_points(self):
        self.assertEqual(len(normalize_answer_text("\U0001F600" * 1500)), 1500)

    def test_hash_ignores_order_duplicates_and_blank_answers(self):
        a = [{"question_id": "q2", "kind": "multi_select", "option_ids": ["o3", "o1", "o1"]},
             {"question_id": "q1", "kind": "short_answer", "text": " Hello\r\nworld "},
             {"question_id": "q3", "kind": "single_choice", "option_ids": []},
             {"question_id": "q4", "kind": "short_answer", "text": "   "}]
        b = [{"question_id": "q1", "kind": "short_answer", "text": "Hello\nworld"},
             {"question_id": "q2", "kind": "multi_select", "option_ids": ["o1", "o3"]}]
        self.assertEqual(canonical_answers_hash(a), canonical_answers_hash(b))
        self.assertEqual(len(canonical_answers_hash(a)), 64)

    def test_hash_differs_for_different_answers_and_accepts_the_stored_shape(self):
        one = [{"question_id": "q1", "kind": "single_choice", "option_id": "o1"}]
        two = [{"question_id": "q1", "kind": "single_choice", "option_id": "o2"}]
        stored = [{"question_id": "q1", "kind": "single_choice", "answer": {"option_ids": ["o1"]}}]
        self.assertNotEqual(canonical_answers_hash(one), canonical_answers_hash(two))
        self.assertEqual(canonical_answers_hash(one), canonical_answers_hash(stored))
        self.assertEqual(canonical_answers_hash([]), canonical_answers_hash([{"question_id": "q", "kind": "short_answer", "text": ""}]))


if __name__ == "__main__":
    unittest.main()
