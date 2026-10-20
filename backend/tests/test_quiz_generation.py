"""Eligibility, evidence, validation, stored shape and the model ladder (fake providers only)."""

import asyncio
import copy
import json
import random
from pathlib import Path

import pytest

from backend import quiz_generation as g
from backend.quiz_limits import ProviderLedger, QuizConfig
from backend.quiz_models import GeneratedQuiz
from backend.tests.quiz_fakes import (
    CONTENT, FILLER, LESSONS, MATERIAL, REFERENCES, FakeQuizModel, completed, generated_dict, incomplete,
    provider_error, refused,
)

CONFIG = QuizConfig()
EXAMPLE = json.loads((Path(__file__).parent / "fixtures" / "quiz_stored_example.json").read_text(encoding="utf-8"))


def eligible(config=CONFIG, material=MATERIAL, **flags):
    return g.quiz_eligibility(material, {"confirmed": True, "needs_review": False, **flags}, config)


def run_ladder(script, config=CONFIG, ledger=None):
    result = eligible(config)
    model = FakeQuizModel(script)
    ledger = ledger or ProviderLedger()
    try:
        outcome = asyncio.run(g.generate_quiz(model, config, CONTENT, result.evidence, result.shape, ledger))
    except g.QuizGenerationFailure as failure:
        return model, ledger, failure
    return model, ledger, outcome


def invalid_text():
    return json.dumps({"questions": []})


# --- eligibility ------------------------------------------------------------------------


def test_a_confirmed_cited_path_is_eligible_with_the_expected_shape():
    result = eligible()
    assert result.ok and result.reason is None
    assert result.covered_lessons == (0, 1)
    assert (result.shape.det_min, result.shape.total_min, result.shape.total_max, result.shape.short_max) == (4, 5, 8, 2)


def test_not_ready_reasons_and_precedence():
    assert eligible(confirmed=False, needs_review=True).reason == "plan_not_confirmed"
    assert eligible(needs_review=True).reason == "evidence_changed"
    assert g.quiz_eligibility({"content": CONTENT, "source_references": []}, {"confirmed": True}, CONFIG).reason == "evidence_changed"
    assert g.quiz_eligibility(None, {"confirmed": True}, CONFIG).reason == "evidence_changed"
    few = {"content": CONTENT, "source_references": REFERENCES[:2]}
    assert g.quiz_eligibility(few, {}, CONFIG).reason == "not_enough_cited_material"
    short = {"content": CONTENT, "source_references": [{**r, "excerpt": "tiny " + r["id"]} for r in REFERENCES]}
    assert g.quiz_eligibility(short, {}, CONFIG).reason == "not_enough_cited_material"
    nothing = {"content": {**CONTENT, "lessons": [{**LESSONS[0], "explanation": {"text": "t", "citation_ids": ["p9999"]},
                                                   "check": {**LESSONS[0]["check"], "worked_answer": {"text": "t", "citation_ids": ["p9998"]}}}]},
               "source_references": REFERENCES}
    assert g.quiz_eligibility(nothing, {}, CONFIG).reason == "not_enough_cited_material"


def test_disabled_is_not_an_eligibility_reason():
    assert eligible(QuizConfig(enabled=False)).ok


def test_four_lessons_at_the_default_cover_the_first_two_and_the_last():
    lessons = [{**LESSONS[0], "explanation": {"text": "t", "citation_ids": [f"p000{i + 1}"]},
                "check": {**LESSONS[0]["check"], "worked_answer": {"text": "t", "citation_ids": [f"p000{i + 1}"]}}, "example": None}
               for i in range(4)]
    result = g.quiz_eligibility({"content": {**CONTENT, "lessons": lessons}, "source_references": REFERENCES}, {}, CONFIG)
    assert result.ok and result.covered_lessons == (0, 1, 3)
    assert result.shape.det_min == 6 and (result.shape.total_min, result.shape.total_max) == (7, 8)


# --- evidence selection -----------------------------------------------------------------


def test_evidence_is_admitted_round_robin_and_includes_the_source_backed_example():
    evidence = g.select_quiz_evidence(MATERIAL, CONFIG)
    assert list(evidence.admitted) == ["p0001", "p0003", "p0002", "p0004"]
    assert evidence.quizzable == [0, 1]
    assert evidence.cited_by_lesson == {0: ["p0001", "p0002"], 1: ["p0003", "p0004"]}


def test_generated_examples_and_unknown_ids_contribute_nothing():
    lessons = copy.deepcopy(LESSONS)
    lessons[1]["example"] = {"text": "t", "provenance": "generated_example", "citation_ids": []}
    lessons[0]["explanation"]["citation_ids"] = ["p0001", "p7777"]
    evidence = g.select_quiz_evidence({"content": {**CONTENT, "lessons": lessons}, "source_references": REFERENCES}, CONFIG)
    assert "p0004" not in evidence.admitted and "p7777" not in evidence.admitted
    assert evidence.cited_by_lesson[1] == ["p0003"]


def test_excerpt_budget_is_24000_characters():
    references = [{"id": f"p{i:04d}", "start": 0, "end": 1000, "excerpt": "x" * 1000} for i in range(1, 31)]
    ids = lambda a, b: [f"p{i:04d}" for i in range(a, b)]
    lesson = {"title": "t", "outcome": "o", "explanation": {"text": "t", "citation_ids": ids(1, 11)},
              "example": {"text": "t", "provenance": "source_backed", "citation_ids": ids(21, 31)},
              "check": {"worked_answer": {"text": "t", "citation_ids": ids(11, 21)}}}
    evidence = g.select_quiz_evidence({"content": {"lessons": [lesson]}, "source_references": references}, CONFIG)
    assert len(evidence.admitted) == 24 and sum(map(len, evidence.admitted.values())) == 24_000


def test_the_prompt_carries_excerpts_only_never_lesson_text_or_background():
    result = eligible()
    data = json.dumps(g.build_prompt_data(CONTENT, result.evidence, result.shape))
    assert "SECRET" not in data
    for lesson in LESSONS:
        assert lesson["check"]["question"] not in data
    assert REFERENCES[0]["excerpt"] in data and "Explain evidence support" in data
    parsed = json.loads(data)
    assert set(parsed) == {"path_title", "quiz_shape", "lessons", "evidence"}
    assert parsed["quiz_shape"]["covered_lessons"] == [0, 1]
    assert {lesson["lesson_index"] for lesson in parsed["lessons"]} == {0, 1}
    assert all(set(e) == {"id", "excerpt"} for e in parsed["evidence"])


def test_only_covered_lessons_and_their_passages_are_sent():
    lessons = [{**LESSONS[0], "explanation": {"text": "t", "citation_ids": [f"p000{i + 1}"]},
                "check": {**LESSONS[0]["check"], "worked_answer": {"text": "t", "citation_ids": [f"p000{i + 1}"]}}, "example": None}
               for i in range(4)]
    material = {"content": {**CONTENT, "lessons": lessons}, "source_references": REFERENCES}
    result = g.quiz_eligibility(material, {}, CONFIG)
    data = g.build_prompt_data(material["content"], result.evidence, result.shape)
    assert [lesson["lesson_index"] for lesson in data["lessons"]] == [0, 1, 3]
    assert [e["id"] for e in data["evidence"]] == ["p0001", "p0002", "p0004"]


# --- validation -------------------------------------------------------------------------


def violations(change):
    quiz = generated_dict()
    change(quiz["questions"])
    result = eligible()
    parsed = GeneratedQuiz.model_validate_json(json.dumps(quiz))
    with pytest.raises(g.QuizValidationError) as caught:
        g.validate_generated_quiz(parsed, result.evidence, result.shape)
    return caught.value.reasons


def test_a_valid_quiz_passes():
    result = eligible()
    g.validate_generated_quiz(GeneratedQuiz.model_validate_json(json.dumps(generated_dict())), result.evidence, result.shape)


@pytest.mark.parametrize("rule,change", [
    ("V2", lambda q: q.pop()),
    ("V3", lambda q: q[0].update(lesson_index=3)),
    ("V4", lambda q: q[0]["options"].pop()),
    ("V5", lambda q: q[0].update(explanation="See p0003 for the answer")),
    ("V6", lambda q: q.__setitem__(4, {**q[5], "lesson_index": 1, "prompt": "Another short one about checking?"})),
    ("V7", lambda q: q[0].update(citation_ids=["p0003"])),
    ("V8", lambda q: q[0].update(criteria=["unexpected"])),
    ("V9", lambda q: q[0]["options"][1].update(is_correct=True)),
    ("V10", lambda q: q[0]["options"][0].update(text="Photosynthesis converts sunlight into chemical energy")),
])
def test_each_rule_rejects_its_violation(rule, change):
    assert any(r.startswith(rule + ":") for r in violations(change))


def test_reasons_name_rules_and_never_quote_the_text():
    reasons = violations(lambda q: q[0]["options"][0].update(text="Photosynthesis converts sunlight into chemical energy"))
    assert all("Photosynthesis" not in r for r in reasons)


# --- the stored form --------------------------------------------------------------------


def stored(seed=1):
    return g.build_stored_quiz(GeneratedQuiz.model_validate_json(json.dumps(generated_dict())),
                               g.lesson_outcome_titles(CONTENT), random.Random(seed))


def test_stored_quiz_has_exactly_the_keys_of_the_shared_example():
    value, example = stored(), EXAMPLE
    assert set(value) == set(example) == {"questions", "key", "outcomes"}
    assert {frozenset(q) for q in value["questions"]} == {frozenset(q) for q in example["questions"]}
    assert {frozenset(k) for k in value["key"]} == {frozenset(k) for k in example["key"]}
    assert {frozenset(o) for o in value["outcomes"]} == {frozenset(o) for o in example["outcomes"]}
    assert {frozenset(o) for q in value["questions"] for o in q["options"]} == {frozenset({"id", "text"})}
    assert value["outcomes"] == example["outcomes"]


def test_public_and_key_rows_are_separate_and_the_public_rows_carry_no_key():
    value = stored()
    for question in value["questions"]:
        assert not {"correct_option_ids", "explanation", "citation_ids", "criteria", "model_answer", "is_correct"} & set(question)
        for option in question["options"]:
            assert set(option) == {"id", "text"}
    assert [q["position"] for q in value["questions"]] == [k["position"] for k in value["key"]] == list(range(6))


def test_option_ids_true_false_and_the_key_follow_the_shuffle():
    generated = GeneratedQuiz.model_validate_json(json.dumps(generated_dict()))
    first = stored(1)
    for question, key, original in zip(first["questions"], first["key"], sorted(
            generated.questions, key=lambda q: (q.kind == "short_answer", q.lesson_index))):
        if original.kind == "short_answer":
            assert question["options"] == [] and key["correct_option_ids"] is None and len(key["criteria"]) >= 2
            continue
        texts = {o["id"]: o["text"] for o in question["options"]}
        right = sorted(o.text for o in original.options if o.is_correct)
        assert sorted(texts[i] for i in key["correct_option_ids"]) == right
        if original.kind == "true_false":
            assert [o["id"] for o in question["options"]] == ["true", "false"]
        else:
            assert [o["id"] for o in question["options"]] == [f"o{n}" for n in range(1, len(question["options"]) + 1)]
    orders = {json.dumps([o["text"] for o in stored(seed)["questions"][0]["options"]]) for seed in range(12)}
    assert len(orders) > 1


# --- the ladder -------------------------------------------------------------------------


def test_valid_on_call_one_is_a_single_luna_call():
    model, ledger, (quiz, use) = run_ladder([completed(generated_dict())])
    assert len(model.calls) == 1 and use.calls == 1 and use.fallback_used is False
    assert use.model == "gpt-6-luna" and (use.tokens_in, use.tokens_out) == (100, 50)
    assert ledger.calls_started == 1 and not ledger.refundable


def test_request_carries_config_only_values():
    config = QuizConfig(generation_model="custom-gen", fallback_model="custom-fb", max_output_tokens=5555)
    model, _ledger, _result = run_ladder([completed(generated_dict())], config)
    call = model.calls[0]
    assert (call["model"], call["max_output_tokens"], call["schema"]) == ("custom-gen", 5555, "GeneratedQuiz")
    assert "evidence" in json.loads(call["input"]) and "mastered" in call["instructions"]


def test_invalid_then_valid_repairs_once_without_the_fallback():
    model, _ledger, (quiz, use) = run_ladder([completed(invalid_text()), completed(generated_dict())])
    assert [c["model"] for c in model.calls] == ["gpt-6-luna", "gpt-6-luna"]
    assert use.fallback_used is False and use.calls == 2
    repair = json.loads(model.calls[1]["input"])
    assert set(repair) == {"input", "validation_feedback", "instruction"} and repair["validation_feedback"]


def test_the_fallback_runs_only_after_a_repair_also_failed():
    model, _ledger, (quiz, use) = run_ladder([completed(invalid_text()), completed(invalid_text()), completed(generated_dict(), "gpt-6.1-sol")])
    assert [c["model"] for c in model.calls] == ["gpt-6-luna", "gpt-6-luna", "gpt-6.1-sol"]
    assert use.fallback_used is True and use.model == "gpt-6.1-sol" and use.calls == 3


def test_three_invalid_responses_end_as_invalid_output_after_exactly_three_calls():
    model, ledger, failure = run_ladder([completed(invalid_text())] * 3)
    assert failure.reason == "invalid_output" and len(model.calls) == 3 and not ledger.refundable


def test_rule_violations_also_trigger_the_ladder():
    bad = generated_dict()
    bad["questions"][0]["options"][0]["text"] = "Photosynthesis converts sunlight into chemical energy"
    model, _ledger, (quiz, use) = run_ladder([completed(bad), completed(generated_dict())])
    assert use.calls == 2 and "V10" in json.loads(model.calls[1]["input"])["validation_feedback"][0]


def test_sol_is_never_called_after_a_transport_error():
    model, ledger, failure = run_ladder([completed(invalid_text()), provider_error("provider_unavailable", "http", 503)])
    assert failure.reason == "provider_unavailable" and len(model.calls) == 2 and not ledger.refundable


def test_truncated_or_refused_is_terminal_after_the_call_that_produced_it():
    model, _l, failure = run_ladder([incomplete()])
    assert (failure.reason, len(model.calls)) == ("truncated", 1)
    model, _l, failure = run_ladder([refused()])
    assert (failure.reason, len(model.calls)) == ("refused", 1)
    model, _l, failure = run_ladder([completed(invalid_text()), incomplete()])
    assert (failure.reason, len(model.calls)) == ("truncated", 2)
    model, _l, failure = run_ladder([completed(invalid_text()), completed(invalid_text()), refused()])
    assert (failure.reason, len(model.calls)) == ("refused", 3)


@pytest.mark.parametrize("status", [401, 403, 404])
def test_rejected_credentials_or_models_mean_setup_required_and_are_refundable(status):
    model, ledger, failure = run_ladder([provider_error("setup_required", "http", status)])
    assert failure.reason == "setup_required" and len(model.calls) == 1 and ledger.refundable


def test_a_missing_key_starts_no_call_and_is_refundable():
    _model, ledger, failure = run_ladder([provider_error("setup_required", None)])
    assert failure.reason == "setup_required" and ledger.calls_started == 0 and ledger.refundable


def test_timeouts_map_to_timeout_and_are_not_refundable():
    _model, ledger, failure = run_ladder([provider_error("timeout", "ReadTimeout")])
    assert failure.reason == "timeout" and not ledger.refundable


def test_the_overall_deadline_maps_to_timeout_and_the_started_call_stays_spent(monkeypatch):
    monkeypatch.setattr(g, "GENERATION_DEADLINE", 0.05)

    class Slow:
        async def call(self, *, ledger, **_):
            ledger.begin()
            await asyncio.sleep(5)

    result, ledger = eligible(), ProviderLedger()
    with pytest.raises(g.QuizGenerationFailure) as caught:
        asyncio.run(g.generate_quiz(Slow(), CONFIG, CONTENT, result.evidence, result.shape, ledger))
    assert caught.value.reason == "timeout" and not ledger.refundable


def test_never_more_than_three_calls():
    model, _l, failure = run_ladder([completed(invalid_text())] * 10)
    assert len(model.calls) == 3 == g.MAX_CALLS


def test_a_maximal_legal_quiz_fits_in_the_default_output_cap():
    option = lambda: {"text": "x" * 100, "is_correct": False}
    base = {"lesson_index": 3, "prompt": "p" * 200, "explanation": "e" * 400, "citation_ids": ["p" + "0" * 15] * 3}
    det = {**base, "kind": "multi_select", "options": [option() for _ in range(5)], "criteria": [], "model_answer": None}
    short = {**base, "kind": "short_answer", "options": [], "criteria": ["c" * 150] * 4, "model_answer": "m" * 400}
    quiz = GeneratedQuiz.model_validate_json(json.dumps({"questions": [det] * 6 + [short] * 2}))
    estimate = len(quiz.model_dump_json()) / 4
    assert estimate <= CONFIG.max_output_tokens and 2500 <= estimate <= 3800
