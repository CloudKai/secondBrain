"""Strict quiz contracts: no answer key before grading, extra fields forbidden, string UUIDs."""

import json

import pytest
from pydantic import TypeAdapter, ValidationError

from backend.quiz import models as m
from backend.tests.quiz_fakes import generated_dict

Q1 = "11111111-1111-4111-8111-111111111111"
Q2 = "22222222-2222-4222-8222-222222222222"
QUIZ = "33333333-3333-4333-8333-333333333333"
ATTEMPT = "44444444-4444-4444-8444-444444444444"
PLAN = "55555555-5555-4555-8555-555555555555"
KEY_FIELDS = {"correct_option_ids", "is_correct", "correct", "explanation", "citation_ids", "criteria",
              "model_answer", "rubric", "answer_key", "reveal", "result", "signal"}
PUBLIC_CLASSES = [m.QuizOption, m.PublicSingleChoiceQuestion, m.PublicTrueFalseQuestion,
                  m.PublicMultiSelectQuestion, m.PublicShortAnswerQuestion, m.PublicQuiz]


def property_names(node):
    names = set()
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "properties" and isinstance(value, dict):
                names |= set(value)
            names |= property_names(value)
    elif isinstance(node, list):
        for item in node:
            names |= property_names(item)
    return names


def parse(adapter, data):
    """Validate JSON-mode like the API does: strict models accept string UUIDs there."""
    return adapter.validate_json(json.dumps(data))


def options(*ids):
    return [{"id": i, "text": f"Option {i}"} for i in ids]


def public_questions():
    base = {"outcome_index": 0, "outcome_title": "Outcome", "position": 0}
    return [
        {**base, "id": Q1, "kind": "single_choice", "prompt": "One?", "options": options("o1", "o2", "o3", "o4")},
        {**base, "id": Q2, "kind": "true_false", "position": 1, "prompt": "Two?", "options": [{"id": "true", "text": "True"}, {"id": "false", "text": "False"}]},
        {**base, "id": "66666666-6666-4666-8666-666666666666", "kind": "multi_select", "position": 2, "prompt": "Three?", "options": options("o1", "o2", "o3", "o4", "o5")},
        {**base, "id": "77777777-7777-4777-8777-777777777777", "kind": "short_answer", "position": 3, "prompt": "Four?", "max_chars": 1500},
    ]


def public_quiz(**changes):
    return {"id": QUIZ, "generated_at": "2026-10-21T09:14:03Z", "question_count": 4,
            "outcomes": [{"index": 0, "title": "Outcome"}], "redacted": False, "source_version": 1,
            "questions": public_questions(), **changes}


def state(**changes):
    return {"status": "ready", "regenerating": False, "not_ready_reason": None,
            "plan": {"is_active": True, "evidence_current": True, "source_version": 1},
            "quiz": public_quiz(), "attempts": [],
            "usage": {"generations_used": 1, "generations_limit": 3, "resets_at": "2026-10-22T00:00:00Z"},
            "can_generate": True, "generate_blocked": None, "can_take": True, **changes}


# --- the key never appears in a public payload ----------------------------------------


@pytest.mark.parametrize("model", PUBLIC_CLASSES)
def test_public_schemas_have_no_key_property(model):
    assert not property_names(model.model_json_schema()) & KEY_FIELDS


def test_quiz_state_schema_has_no_key_property_except_the_attempt_summary_count():
    # QuizAttemptSummary.correct is the learner's own X of Y count, not a key.
    assert not property_names(m.QuizState.model_json_schema()) & (KEY_FIELDS - {"correct"})


def test_public_payload_round_trips_without_key_material():
    parsed = m.QuizState.model_validate_json(json.dumps(state()))
    text = parsed.model_dump_json()
    for name in KEY_FIELDS:
        assert f'"{name}"' not in text
    assert "SENTINEL" not in text


@pytest.mark.parametrize("field,value", [
    ("correct_option_ids", ["o1"]), ("explanation", "SENTINEL-EXPLANATION"), ("citation_ids", ["p0001"]),
    ("criteria", ["SENTINEL-CRITERION"]), ("model_answer", "SENTINEL-ANSWER"), ("is_correct", True),
    ("result", "correct"), ("signal", "positive"), ("reveal", {"explanation": "SENTINEL"}),
])
def test_public_questions_refuse_key_fields(field, value):
    for question in public_questions():
        with pytest.raises(ValidationError):
            parse(TypeAdapter(m.PublicQuestion), {**question, field: value})


def test_public_options_refuse_is_correct():
    with pytest.raises(ValidationError):
        m.QuizOption.model_validate({"id": "o1", "text": "x", "is_correct": True})


def test_public_quiz_refuses_extra_fields_and_mismatched_counts():
    with pytest.raises(ValidationError):
        m.PublicQuiz.model_validate_json(json.dumps(public_quiz(correct_option_ids=[])))
    with pytest.raises(ValidationError):
        m.PublicQuiz.model_validate_json(json.dumps(public_quiz(question_count=5)))


def test_redacted_quiz_has_no_questions_and_an_unredacted_one_must_have_them():
    ok = m.PublicQuiz.model_validate_json(json.dumps(public_quiz(redacted=True, questions=[])))
    assert ok.redacted and ok.questions == []
    with pytest.raises(ValidationError):
        m.PublicQuiz.model_validate_json(json.dumps(public_quiz(redacted=True)))
    with pytest.raises(ValidationError):
        m.PublicQuiz.model_validate_json(json.dumps(public_quiz(questions=[])))


def test_questions_parse_by_kind_and_reject_wrong_kind_field_combinations():
    parsed = m.PublicQuiz.model_validate_json(json.dumps(public_quiz()))
    assert [type(q).__name__ for q in parsed.questions] == [
        "PublicSingleChoiceQuestion", "PublicTrueFalseQuestion", "PublicMultiSelectQuestion", "PublicShortAnswerQuestion"]
    adapter = TypeAdapter(m.PublicQuestion)
    single = public_questions()[0]
    with pytest.raises(ValidationError):
        parse(adapter, {**single, "kind": "poll"})
    with pytest.raises(ValidationError):
        parse(adapter, {**single, "options": options("o1", "o2")})
    with pytest.raises(ValidationError):
        parse(adapter, {**single, "max_chars": 1500})
    short = public_questions()[3]
    with pytest.raises(ValidationError):
        parse(adapter, {**short, "options": []})
    with pytest.raises(ValidationError):
        parse(adapter, {**single, "options": [{"id": "x1", "text": "bad id"}] * 4})


# --- graded family ----------------------------------------------------------------------


def graded_choice(**changes):
    return {"kind": "single_choice", "question_id": Q1, "position": 0, "prompt": "One?", "outcome_index": 0,
            "options": options("o1", "o2", "o3", "o4"), "selected_option_ids": ["o2"], "correct_option_ids": ["o2"],
            "result": "correct", "signal": "positive", "explanation": "Because.", "citation_ids": ["p0001"], **changes}


def graded_short(**changes):
    return {"kind": "short_answer", "question_id": Q2, "position": 5, "prompt": "Explain?", "outcome_index": 1,
            "answer_text": "Mine", "result": None, "signal": None, "grading_state": "pending", "unavailable_reason": None,
            "criteria": [{"index": 0, "text": "A", "assessment": None, "observation": None, "citation_ids": []},
                         {"index": 1, "text": "B", "assessment": None, "observation": None, "citation_ids": []}],
            "feedback_summary": None, "next_hint": None, "model_answer": "Model", "explanation": "Because.",
            "citation_ids": ["p0002"], "provisional": True, **changes}


def redacted(**changes):
    return {"kind": "redacted", "question_id": "88888888-8888-4888-8888-888888888888", "position": 3, "outcome_index": 1,
            "original_kind": "multi_select", "selected_option_ids": ["o2"], "answer_text": None,
            "result": "incorrect", "signal": "negative", **changes}


def attempt(questions):
    return {"attempt_id": ATTEMPT, "quiz_id": QUIZ, "plan_id": PLAN, "quiz_is_current": True,
            "submitted_at": "2026-10-21T09:20:41Z", "score": {"correct": 1, "total": 3},
            "outcomes": [{"index": 0, "title": "T", "label": "worth_reviewing", "ai_contributed": False, "correct": 1,
                          "to_review": 2, "short_needs_review": 0, "short_blank": 0, "short_open": 1}],
            "review_first": [0], "short_answers": {"total": 1, "pending": 1, "unavailable": 0},
            "grading_usage": {"used": 0, "limit": 20, "resets_at": "2026-10-22T00:00:00Z"}, "questions": questions}


def test_graded_questions_require_the_key_fields():
    adapter = TypeAdapter(m.GradedQuestion)
    assert parse(adapter, graded_choice()).correct_option_ids == ["o2"]
    for field in ("correct_option_ids", "explanation", "citation_ids"):
        broken = graded_choice()
        del broken[field]
        with pytest.raises(ValidationError):
            parse(adapter, broken)
    for field in ("model_answer", "criteria", "explanation", "citation_ids"):
        broken = graded_short()
        del broken[field]
        with pytest.raises(ValidationError):
            parse(adapter, broken)


def test_redacted_variant_forbids_every_key_prompt_and_option_field():
    adapter = TypeAdapter(m.GradedQuestion)
    assert parse(adapter, redacted()).kind == "redacted"
    for field, value in (("prompt", "x"), ("options", options("o1")), ("explanation", "x"), ("citation_ids", ["p0001"]),
                         ("criteria", ["x"]), ("model_answer", "x"), ("correct_option_ids", ["o1"]), ("reveal", {})):
        with pytest.raises(ValidationError):
            parse(adapter, redacted(**{field: value}))


def test_an_attempt_with_graded_and_redacted_questions_round_trips():
    questions = [graded_choice(), graded_choice(position=1, question_id="99999999-9999-4999-8999-999999999999"),
                 graded_short(), redacted()]
    body = json.dumps(attempt(questions))
    parsed = m.QuizAttemptResult.model_validate_json(body)
    assert [q.kind for q in parsed.questions] == ["single_choice", "single_choice", "short_answer", "redacted"]
    assert m.QuizAttemptResult.model_validate_json(parsed.model_dump_json()) == parsed


def test_attempt_result_refuses_extra_fields_and_user_id():
    body = attempt([graded_choice()] * 3)
    for extra in ({"user_id": Q1}, {"unknown": 1}):
        with pytest.raises(ValidationError):
            m.QuizAttemptResult.model_validate_json(json.dumps({**body, **extra}))


# --- requests ---------------------------------------------------------------------------


def test_request_bodies_accept_string_uuids():
    generate = m.QuizGenerateRequest.model_validate({"request_id": Q1, "regenerate": True})
    assert str(generate.request_id) == Q1 and generate.regenerate
    assert m.QuizGenerateRequest.model_validate({"request_id": Q1}).regenerate is False
    body = {"attempt_key": Q1, "quiz_id": QUIZ, "answers": [
        {"question_id": Q1, "kind": "single_choice", "option_id": "o3"},
        {"question_id": Q2, "kind": "true_false", "option_id": "false"},
        {"question_id": "66666666-6666-4666-8666-666666666666", "kind": "multi_select", "option_ids": ["o1", "o4"]},
        {"question_id": "77777777-7777-4777-8777-777777777777", "kind": "short_answer", "text": "My answer"}]}
    parsed = m.QuizSubmitRequest.model_validate(body)
    assert [type(a).__name__ for a in parsed.answers] == ["ChoiceAnswer", "ChoiceAnswer", "MultiSelectAnswer", "ShortAnswerInput"]
    assert m.QuizSubmitRequest.model_validate_json(json.dumps(body)) == parsed


@pytest.mark.parametrize("change", [
    {"user_id": Q1}, {"request_id": "not-a-uuid"}, {"regenerate": "yes"}, {"extra": 1},
])
def test_generate_request_rejects_bad_input(change):
    with pytest.raises(ValidationError):
        m.QuizGenerateRequest.model_validate({"request_id": Q1, **change})


def test_submit_request_rejects_bad_answers():
    good = {"question_id": Q1, "kind": "single_choice", "option_id": "o1"}
    for answer in ({**good, "kind": "poll"}, {**good, "option_id": "o9"}, {**good, "option_ids": ["o1"]},
                   {**good, "text": "x"}, {"question_id": Q1, "kind": "multi_select", "option_ids": ["o1", "bad"]},
                   {"question_id": Q1, "kind": "short_answer", "text": "x" * 20_001}, {**good, "question_id": "nope"}):
        with pytest.raises(ValidationError):
            m.QuizSubmitRequest.model_validate({"attempt_key": Q1, "quiz_id": QUIZ, "answers": [answer]})
    with pytest.raises(ValidationError):
        m.QuizSubmitRequest.model_validate({"attempt_key": Q1, "quiz_id": QUIZ, "answers": [good] * 11})


# --- generated family -------------------------------------------------------------------


def test_generated_quiz_schema_has_no_one_of_and_requires_every_field():
    schema = m.GeneratedQuiz.model_json_schema()
    assert "oneOf" not in json.dumps(schema)
    for definition in schema["$defs"].values():
        assert set(definition["properties"]) == set(definition["required"]), definition["title"]
        assert definition.get("additionalProperties") is False


def test_generated_quiz_parses_the_valid_fixture_and_refuses_extra_keys():
    parsed = m.GeneratedQuiz.model_validate_json(json.dumps(generated_dict()))
    assert len(parsed.questions) == 6
    broken = generated_dict()
    broken["questions"][0]["note"] = "x"
    with pytest.raises(ValidationError):
        m.GeneratedQuiz.model_validate_json(json.dumps(broken))


def test_generated_caps_are_the_tightened_ones():
    question = generated_dict()["questions"][0]
    for field, limit in (("prompt", 200), ("explanation", 400)):
        with pytest.raises(ValidationError):
            m.GeneratedQuestion.model_validate({**question, field: "x" * (limit + 1)})
        m.GeneratedQuestion.model_validate({**question, field: "x" * limit})
    with pytest.raises(ValidationError):
        m.GeneratedQuestion.model_validate({**question, "options": [{"text": "x" * 101, "is_correct": True}]})
    short = generated_dict()["questions"][5]
    with pytest.raises(ValidationError):
        m.GeneratedQuestion.model_validate({**short, "criteria": ["x" * 151, "y"]})
    with pytest.raises(ValidationError):
        m.GeneratedQuestion.model_validate({**short, "model_answer": "x" * 401})


def test_short_answer_feedback_bounds():
    good = {"summary": "s", "next_hint": "h", "criteria": [
        {"criterion_index": 0, "assessment": "addressed", "observation": "o", "citation_ids": []},
        {"criterion_index": 1, "assessment": "try_again", "observation": "o", "citation_ids": ["p0001"]}]}
    assert len(m.QuizShortAnswerFeedback.model_validate(good).criteria) == 2
    for change in ({"summary": "x" * 801}, {"next_hint": "x" * 401}, {"extra": 1}, {"criteria": good["criteria"][:1]}):
        with pytest.raises(ValidationError):
            m.QuizShortAnswerFeedback.model_validate({**good, **change})


# --- normalisation and hash are the stdlib implementations -------------------------------


def test_hash_and_normalisation_are_reexported_from_quiz_rules():
    from backend.quiz import rules as quiz_rules

    assert m.canonical_answers_hash is quiz_rules.canonical_answers_hash
    assert m.normalize_answer_text is quiz_rules.normalize_answer_text
    assert m.normalize_answer_text("  a\r\nb  ") == "a\nb"


def test_error_body_shape():
    body = m.QuizErrorResponse.model_validate({"detail": "d", "error": {
        "code": "quiz_generation_limit_reached", "message": "d", "retryable": False, "limit": 3, "used": 3,
        "resets_at": "2026-10-22T00:00:00Z"}})
    assert body.error.limit == 3
    with pytest.raises(ValidationError):
        m.QuizErrorResponse.model_validate({"detail": "d", "error": {"code": "c", "message": "d", "retryable": False, "stack": "x"}})
