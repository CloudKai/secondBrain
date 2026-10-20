"""Shared fakes and builders for the quiz pytest suites (no network, no real provider)."""

import json

from backend.quiz_provider import ModelResponse, ProviderError
from backend.tests.test_quiz_rules import EXCERPTS, valid_quiz

FILLER = " Learners can compare what a passage says with what a claim says before they trust the claim." * 2
REFERENCES = [
    {"id": ident, "start": 0, "end": len(text + FILLER), "excerpt": text + FILLER} for ident, text in EXCERPTS.items()
]
LESSONS = [
    {"title": "Evidence and support", "outcome": "Explain evidence support",
     "explanation": {"text": "SECRET-EXPLANATION-0", "citation_ids": ["p0001", "p0002"]}, "example": None,
     "check": {"kind": "explain", "question": "SECRET-CHECK-0", "criteria": ["c"], "hint": "h",
               "worked_answer": {"text": "SECRET-WORKED-0", "citation_ids": ["p0002"]}}},
    {"title": "Original sources", "outcome": "Revisit original sources",
     "explanation": {"text": "SECRET-EXPLANATION-1", "citation_ids": ["p0003"]},
     "example": {"text": "SECRET-EXAMPLE-1", "provenance": "source_backed", "citation_ids": ["p0004"]},
     "check": {"kind": "apply", "question": "SECRET-CHECK-1", "criteria": ["c"], "hint": "h",
               "worked_answer": {"text": "SECRET-WORKED-1", "citation_ids": ["p0003"]}}},
]
CONTENT = {"title": "Checking claims", "outcomes": ["o"], "prerequisites": [], "coverage": "c", "gaps": [],
           "background": [{"title": "SECRET-BACKGROUND", "purpose": "p", "text": "SECRET-BACKGROUND-TEXT"}],
           "lessons": LESSONS}
MATERIAL = {"content": CONTENT, "source_references": REFERENCES}


def generated_dict():
    """A valid 6-question model output for MATERIAL at the default config."""
    return valid_quiz()


def completed(payload, model="gpt-6-luna", tokens_in=100, tokens_out=50):
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return ModelResponse("completed", model, text=text, tokens_in=tokens_in, tokens_out=tokens_out)


def incomplete(model="gpt-6-luna"):
    return ModelResponse("incomplete", model, reason="truncated")


def refused(model="gpt-6-luna"):
    return ModelResponse("refused", model, reason="refused")


def provider_error(code, kind="ConnectError", status=None, error_type=None):
    """A ProviderError that also records how the real adapter would have settled the ledger.

    kind=None means no request was started (nothing is put in the ledger).
    """
    error = ProviderError(code)
    error.ledger = None if kind is None else (kind, status, error_type)
    return error


class FakeQuizModel:
    """Scripted QuizModel: records every call and drives the ProviderLedger like the real adapter."""

    def __init__(self, script, events=None):
        self.script = list(script)
        self.calls = []
        self.events = events if events is not None else []

    async def call(self, *, model, instructions, input, schema, max_output_tokens, timeout, ledger):
        self.calls.append({"model": model, "instructions": instructions, "input": input,
                           "schema": schema.__name__, "max_output_tokens": max_output_tokens, "timeout": timeout})
        self.events.append("provider")
        item = self.script.pop(0)
        if isinstance(item, ProviderError):
            info = getattr(item, "ledger", ("ConnectError", None, None))
            if info is not None:
                ledger.begin()
                ledger.settle(*info)
            raise item
        ledger.begin()
        ledger.settle("http", 200)
        return item
