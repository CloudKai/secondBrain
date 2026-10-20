"""An in-memory stand-in for the quiz SQL functions (JSON in, JSON out), for API and store tests.

It mirrors the behaviours the backend relies on: replay-first lookups, leases,
single flight, the atomic counter, key secrecy, the `reveal` snapshot and the
refund rules. It is NOT the SQL; the PGlite suite covers the real functions.
"""

import copy
import json
import uuid

import httpx

from backend.tests.quiz_fakes import CONTENT, REFERENCES

OWNER = "11111111-1111-4111-8111-111111111111"
COLLECTION = "77777777-7777-4777-8777-777777777777"
PLAN = "55555555-5555-4555-8555-555555555555"
TOKEN, PUBLIC_KEY, SERVER_KEY = "owner-token", "public-test", "server-test"
RESETS = "2026-10-22T00:00:00Z"
SERVICE = {"charge_quiz_generation", "finish_quiz_generation", "fail_quiz_generation", "get_quiz_grading_context",
           "finish_quiz_attempt", "get_quiz_short_answer_context", "charge_quiz_grading", "finish_quiz_short_answer"}
CHOICE = ("single_choice", "true_false", "multi_select")


class SqlError(Exception):
    def __init__(self, sqlstate, message):
        super().__init__(message)
        self.sqlstate, self.message = sqlstate, message


class FakeSupabase:
    def __init__(self):
        self.user, self.collection, self.plan = OWNER, COLLECTION, PLAN
        self.content, self.references = copy.deepcopy(CONTENT), copy.deepcopy(REFERENCES)
        self.active = self.current = True
        self.stale_on_finish = False
        self.quizzes, self.attempts = {}, {}
        self.used = {"generation": 0, "grading": 0}
        self.events, self.calls, self.failures = [], [], {}
        self.n = 0

    # -- helpers ------------------------------------------------------------------------

    def new_id(self):
        self.n += 1
        return f"00000000-0000-4000-8000-{self.n:012d}"

    def owned(self, collection, plan):
        if collection != self.collection or plan != self.plan:
            raise SqlError("P0002", "quiz_not_found")

    def expire_leases(self):
        for row in self.quizzes.values():
            row["lease_live"] = False
        for attempt in self.attempts.values():
            attempt["lease_live"] = False
            for answer in attempt["answers"].values():
                answer["lease_live"] = False

    def current_quiz(self):
        return next((q for q in self.quizzes.values() if q["is_current"]), None)

    def consume(self, kind, limit):
        if self.used[kind] >= limit:
            return {"allowed": False, "used": self.used[kind], "limit": limit, "usage_date": "2026-10-21", "resets_at": "2026-10-22T00:00:00+00:00"}
        self.used[kind] += 1
        return {"allowed": True, "used": self.used[kind], "limit": limit, "usage_date": "2026-10-21", "resets_at": "2026-10-22T00:00:00+00:00"}

    def redact_source(self):
        """What deleting the source does: keys deleted, text removed, results kept."""
        for quiz in self.quizzes.values():
            quiz["redacted"] = True
            for q in quiz["questions"]:
                q.update(prompt=None, options=None, redacted=True)
            quiz["keys"] = {}
        for attempt in self.attempts.values():
            for answer in attempt["answers"].values():
                answer.update(reveal=None, feedback=None, redacted=True)

    # -- the HTTP face --------------------------------------------------------------------

    def handler(self, request):
        path, headers = request.url.path, request.headers
        if path == "/auth/v1/user":
            ok = headers.get("authorization") == f"Bearer {TOKEN}"
            return httpx.Response(200, json={"id": self.user}) if ok else httpx.Response(401, json={"message": "bad jwt"})
        name = path.rsplit("/", 1)[-1]
        body = json.loads(request.content or b"{}")
        self.events.append(name)
        self.calls.append((name, body))
        if name in SERVICE and headers.get("apikey") != SERVER_KEY:
            return httpx.Response(401, json={"message": "Invalid API key"})
        if name not in SERVICE and headers.get("authorization") != f"Bearer {TOKEN}":
            return httpx.Response(401, json={"message": "JWT expired"})
        if name in self.failures:
            status, payload = self.failures.pop(name)
            return httpx.Response(status, json=payload)
        try:
            return httpx.Response(200, json=getattr(self, "fn_" + name)(**body))
        except SqlError as error:
            return httpx.Response(400, json={"code": error.sqlstate, "message": error.message})

    def lease_attempt(self, attempt):
        if attempt["status"] == "graded":
            return {"attempt_id": attempt["id"], "lease_token": None, "replay": True}
        if attempt["lease_live"]:
            raise SqlError("55P03", "quiz_attempt_in_progress")
        attempt.update(lease_token=self.new_id(), lease_live=True)
        return {"attempt_id": attempt["id"], "lease_token": attempt["lease_token"], "replay": False}

    # -- 1-6: learner functions --------------------------------------------------------------

    def public_quiz(self, quiz):
        return {"id": quiz["id"], "generated_at": "2026-10-21T09:14:03Z", "question_count": len(quiz["questions"]),
                "outcomes": quiz["outcomes"], "redacted": quiz["redacted"], "source_version": 1,
                "questions": [{k: q[k] for k in ("id", "position", "kind", "prompt", "options", "outcome_index", "outcome_title", "redacted")}
                              for q in quiz["questions"]]}

    def fn_get_quiz_state(self, p_collection_id, p_plan_id, p_include_material=False):
        self.owned(p_collection_id, p_plan_id)
        quiz = self.current_quiz()
        generating = any(q["status"] == "generating" and q["lease_live"] for q in self.quizzes.values())
        attempts = sorted(self.attempts.values(), key=lambda a: -a["n"])[:20]
        state = {
            "plan": {"is_active": self.active, "evidence_current": self.current, "needs_review": not self.current, "source_version": 1},
            "generating": generating, "quiz": self.public_quiz(quiz) if quiz else None,
            "attempts": [{"attempt_id": a["id"], "quiz_id": a["quiz_id"], "quiz_is_current": self.quizzes[a["quiz_id"]]["is_current"],
                          "status": a["status"], "submitted_at": "2026-10-21T09:20:41Z", "correct": a["correct"], "total": a["total"],
                          "short_answers_total": a["short_total"],
                          "short_answers_pending": sum(1 for r in a["answers"].values() if r["grading_state"] == "pending")} for a in attempts],
            "usage": {"generation_used": self.used["generation"], "resets_at": RESETS},
        }
        if p_include_material or (not quiz and not generating):
            state["material"] = {"content": self.content, "source_references": self.references}
        return state

    def fn_request_quiz_generation(self, p_collection_id, p_plan_id, p_request_id, p_regenerate):
        self.owned(p_collection_id, p_plan_id)
        row = next((q for q in self.quizzes.values() if q["request_id"] == p_request_id), None)
        if row:
            if row["regenerate"] != p_regenerate:
                raise SqlError("40001", "quiz_request_changed")
            if row["status"] == "ready":
                return {"quiz_id": row["id"], "lease_token": None, "replay": True}
            if row["status"] == "generating" and row["lease_live"]:
                raise SqlError("55P03", "quiz_generation_in_progress")
        if not self.active:
            raise SqlError("40001", "quiz_plan_not_current")
        if not self.current:
            raise SqlError("40001", "quiz_evidence_changed")
        if row:
            if row["attempts"] >= 3:
                raise SqlError("54000", "quiz_request_exhausted")
        elif not p_regenerate and self.current_quiz():
            return {"quiz_id": self.current_quiz()["id"], "lease_token": None, "replay": True}
        if any(q["status"] == "generating" and q["lease_live"] and q is not row for q in self.quizzes.values()):
            raise SqlError("55P03", "quiz_generation_in_progress")
        for q in self.quizzes.values():
            if q["status"] == "generating" and not q["lease_live"] and q is not row:
                q["status"] = "failed"
        if not row:
            if sum(q["status"] == "ready" for q in self.quizzes.values()) >= 20:
                raise SqlError("54000", "quiz_plan_cap_reached")
            if sum(q["status"] == "failed" for q in self.quizzes.values()) >= 10:
                raise SqlError("54000", "quiz_generation_attempts_capped")
            row = {"id": self.new_id(), "request_id": p_request_id, "regenerate": p_regenerate, "attempts": 0, "is_current": False,
                   "questions": [], "keys": {}, "outcomes": [], "redacted": False, "charge_state": None, "charged_lease": None}
            self.quizzes[row["id"]] = row
        row.update(status="generating", lease_token=self.new_id(), lease_live=True, attempts=row["attempts"] + 1)
        return {"quiz_id": row["id"], "lease_token": row["lease_token"], "replay": False}

    def fn_submit_quiz_attempt(self, p_collection_id, p_plan_id, p_quiz_id, p_attempt_key, p_answers, p_answers_hash):
        self.owned(p_collection_id, p_plan_id)
        quiz = self.quizzes.get(p_quiz_id)
        if not quiz:
            raise SqlError("P0002", "quiz_not_found")
        existing = next((a for a in self.attempts.values() if a["key"] == p_attempt_key), None)
        if existing:
            if existing["quiz_id"] != quiz["id"] or existing["hash"] != p_answers_hash:
                raise SqlError("40001", "quiz_attempt_conflict")
            return self.lease_attempt(existing)
        if quiz["status"] != "ready":
            raise SqlError("P0002", "quiz_not_found")
        if quiz["redacted"] or not self.current:
            raise SqlError("40001", "quiz_evidence_changed")
        if sum(a["quiz_id"] == quiz["id"] for a in self.attempts.values()) >= 20:
            raise SqlError("54000", "quiz_attempt_limit_reached")
        by_id = {q["id"]: q for q in quiz["questions"]}
        ids = [a["question_id"] for a in p_answers]
        if len(set(ids)) != len(ids) or any(i not in by_id for i in ids):
            raise SqlError("22023", "quiz_answer_invalid")
        given = {a["question_id"]: a for a in p_answers}
        answers = {}
        for q in quiz["questions"]:
            item = given.get(q["id"])
            answer = {}
            if item:
                if item["kind"] != q["kind"]:
                    raise SqlError("22023", "quiz_answer_invalid")
                raw = item.get("answer") or {}
                if q["kind"] == "short_answer":
                    text = raw.get("text") or ""
                    if len(text) > 5000:
                        raise SqlError("22023", "quiz_answer_invalid")
                    answer = {"text": text} if text.strip() else {}
                else:
                    picked = sorted(set(raw.get("option_ids") or []))
                    if any(p not in [o["id"] for o in q["options"]] for p in picked):
                        raise SqlError("22023", "quiz_answer_invalid")
                    answer = {"option_ids": picked} if picked else {}
            answers[q["id"]] = {"question_id": q["id"], "kind": q["kind"], "position": q["position"], "outcome_index": q["outcome_index"],
                                "outcome_title": q["outcome_title"], "prompt": q["prompt"], "options": q["options"], "answer": answer,
                                "result": None, "signal": None, "grading_state": "not_applicable", "unavailable_reason": None,
                                "grading_attempts": 0, "feedback": None, "model": None, "reveal": None, "redacted": q["redacted"],
                                "lease_live": False, "lease_token": None, "charge_state": None, "charged_lease": None}
        attempt = {"id": self.new_id(), "n": len(self.attempts), "key": p_attempt_key, "hash": p_answers_hash, "quiz_id": quiz["id"],
                   "status": "grading", "correct": None, "total": sum(q["kind"] in CHOICE for q in quiz["questions"]),
                   "short_total": sum(q["kind"] == "short_answer" for q in quiz["questions"]), "answers": answers,
                   "lease_token": self.new_id(), "lease_live": True}
        self.attempts[attempt["id"]] = attempt
        return {"attempt_id": attempt["id"], "lease_token": attempt["lease_token"], "replay": False}

    def attempt_of(self, collection, plan, attempt_id):
        self.owned(collection, plan)
        if attempt_id not in self.attempts:
            raise SqlError("P0002", "quiz_not_found")
        return self.attempts[attempt_id]

    def fn_claim_quiz_attempt_grading(self, p_collection_id, p_plan_id, p_attempt_id):
        return self.lease_attempt(self.attempt_of(p_collection_id, p_plan_id, p_attempt_id))

    def fn_get_quiz_attempt(self, p_collection_id, p_plan_id, p_attempt_id):
        attempt = self.attempt_of(p_collection_id, p_plan_id, p_attempt_id)
        graded = attempt["status"] == "graded"
        rows = []
        for row in sorted(attempt["answers"].values(), key=lambda r: r["position"]):
            shown = {k: row[k] for k in ("question_id", "position", "kind", "outcome_index", "outcome_title", "prompt", "options",
                                          "answer", "grading_state", "unavailable_reason", "grading_attempts", "redacted")}
            shown.update({k: (row[k] if graded else None) for k in ("result", "signal", "feedback", "model", "reveal")})
            rows.append(shown)
        return {"attempt": {"id": attempt["id"], "quiz_id": attempt["quiz_id"], "plan_id": self.plan, "status": attempt["status"],
                            "submitted_at": "2026-10-21T09:20:41Z", "graded_at": None, "correct": attempt["correct"],
                            "total": attempt["total"], "short_answers_total": attempt["short_total"], "lease_live": attempt["lease_live"],
                            "quiz_is_current": self.quizzes[attempt["quiz_id"]]["is_current"]},
                "answers": rows, "grading_used": self.used["grading"], "grading_resets_at": RESETS}

    def fn_claim_quiz_short_answer(self, p_collection_id, p_plan_id, p_attempt_id, p_question_id):
        attempt = self.attempt_of(p_collection_id, p_plan_id, p_attempt_id)
        row = attempt["answers"].get(p_question_id)
        if not row:
            raise SqlError("P0002", "quiz_not_found")
        if attempt["status"] != "graded":
            raise SqlError("55P03", "quiz_attempt_in_progress")
        if row["kind"] != "short_answer" or row["redacted"] or not row["answer"].get("text"):
            raise SqlError("22023", "quiz_answer_invalid")
        if row["grading_state"] == "graded":
            return {"attempt_id": attempt["id"], "question_id": p_question_id, "lease_token": None, "grading_state": "graded"}
        if row["lease_live"]:
            raise SqlError("55P03", "quiz_grading_busy")
        if row["grading_state"] == "unavailable" and row["unavailable_reason"] != "limit" and row["grading_attempts"] >= 3:
            raise SqlError("54000", "quiz_grading_exhausted")
        row.update(lease_token=self.new_id(), lease_live=True)
        return {"attempt_id": attempt["id"], "question_id": p_question_id, "lease_token": row["lease_token"], "grading_state": row["grading_state"]}

    # -- 7-14: service functions -----------------------------------------------------------------

    def live_quiz(self, quiz_id, lease):
        row = self.quizzes.get(quiz_id)
        if not row or row["status"] != "generating" or row["lease_token"] != lease or not row["lease_live"]:
            raise SqlError("40001", "quiz_lease_lost")
        return row

    def fn_charge_quiz_generation(self, p_quiz_id, p_lease_token, p_limit):
        row = self.live_quiz(p_quiz_id, p_lease_token)
        if row["charge_state"] == "charged" and row["charged_lease"] == p_lease_token:
            return {"allowed": True, "used": self.used["generation"], "limit": p_limit, "usage_date": "2026-10-21", "resets_at": "2026-10-22T00:00:00+00:00"}
        grant = self.consume("generation", p_limit)
        if grant["allowed"]:
            row.update(charge_state="charged", charged_lease=p_lease_token)
        return grant

    def fn_finish_quiz_generation(self, p_quiz_id, p_lease_token, p_quiz, p_model, p_fallback_used, p_tokens_in, p_tokens_out):
        row = self.live_quiz(p_quiz_id, p_lease_token)
        if self.stale_on_finish:
            return False
        if set(p_quiz) != {"questions", "key", "outcomes"} or len(p_quiz["questions"]) != len(p_quiz["key"]):
            raise SqlError("22023", "quiz_invalid_output")
        keys = {k["position"]: k for k in p_quiz["key"]}
        row["questions"], row["keys"] = [], {}
        for q in p_quiz["questions"]:
            qid = self.new_id()
            row["questions"].append({**q, "id": qid, "redacted": False})
            row["keys"][qid] = keys[q["position"]]
        for other in self.quizzes.values():
            other["is_current"] = False
        row.update(status="ready", is_current=True, outcomes=p_quiz["outcomes"], lease_live=False, model=p_model, fallback_used=p_fallback_used)
        return True

    def fn_fail_quiz_generation(self, p_quiz_id, p_lease_token, p_error_code, p_refund):
        row = self.quizzes.get(p_quiz_id)
        if not row:
            return False
        if row["status"] == "failed":
            return True
        if row["status"] != "generating" or row["lease_token"] != p_lease_token:
            raise SqlError("40001", "quiz_lease_lost")
        if p_error_code == "limit":
            del self.quizzes[p_quiz_id]
            return True
        if p_refund and row["charge_state"] == "charged" and row["charged_lease"] == p_lease_token:
            self.used["generation"] -= 1
            row["charge_state"] = "refunded"
        row.update(status="failed", lease_live=False, error_code=p_error_code)
        return True

    def graded_lease(self, attempt_id, lease):
        attempt = self.attempts.get(attempt_id)
        if not attempt or attempt["status"] != "grading" or attempt["lease_token"] != lease or not attempt["lease_live"]:
            raise SqlError("40001", "quiz_lease_lost")
        return attempt

    def fn_get_quiz_grading_context(self, p_attempt_id, p_lease_token):
        attempt = self.graded_lease(p_attempt_id, p_lease_token)
        quiz = self.quizzes[attempt["quiz_id"]]
        items = []
        for row in sorted(attempt["answers"].values(), key=lambda r: r["position"]):
            key = quiz["keys"].get(row["question_id"], {})
            items.append({"question_id": row["question_id"], "position": row["position"], "kind": row["kind"], "outcome_index": row["outcome_index"],
                          "answer": row["answer"], "correct_option_ids": key.get("correct_option_ids"), "explanation": key.get("explanation"),
                          "citation_ids": key.get("citation_ids"), "criteria": key.get("criteria"), "model_answer": key.get("model_answer"),
                          "redacted": row["redacted"]})
        return {"attempt_id": attempt["id"], "user_id": self.user, "quiz_id": attempt["quiz_id"], "plan_id": self.plan,
                "deterministic_total": attempt["total"], "short_answer_total": attempt["short_total"], "questions": items}

    def fn_finish_quiz_attempt(self, p_attempt_id, p_lease_token, p_results):
        attempt = self.graded_lease(p_attempt_id, p_lease_token)
        if set(p_results) != {"correct_count", "results"} or len(p_results["results"]) != len(attempt["answers"]):
            raise SqlError("22023", "quiz_invalid_output")
        correct = 0
        for item in p_results["results"]:
            if set(item) != {"question_id", "result", "signal", "reveal"}:
                raise SqlError("22023", "quiz_invalid_output")
            row = attempt["answers"][item["question_id"]]
            if row["kind"] == "short_answer":
                blank = row["answer"] == {}
                if blank != (item["result"] == "unanswered") or (not blank and item["result"] is not None):
                    raise SqlError("22023", "quiz_invalid_output")
                row["grading_state"] = "not_applicable" if blank else "pending"
            else:
                correct += item["result"] == "correct"
            row.update(result=item["result"], signal=item["signal"], reveal=item["reveal"])
        if correct != p_results["correct_count"]:
            raise SqlError("22023", "quiz_invalid_output")
        attempt.update(status="graded", correct=correct, lease_live=False, lease_token=None)
        return True

    def short_row(self, attempt_id, question_id, lease, live=True):
        attempt = self.attempts.get(attempt_id)
        row = attempt["answers"].get(question_id) if attempt else None
        if not row or row["lease_token"] != lease or (live and not row["lease_live"]):
            raise SqlError("40001", "quiz_lease_lost")
        return attempt, row

    def fn_get_quiz_short_answer_context(self, p_attempt_id, p_question_id, p_lease_token):
        attempt, row = self.short_row(p_attempt_id, p_question_id, p_lease_token)
        key = self.quizzes[attempt["quiz_id"]]["keys"][p_question_id]
        passages = [r for r in self.references if r["id"] in key["citation_ids"]]
        return {"user_id": self.user, "attempt_id": attempt["id"], "question_id": p_question_id, "quiz_id": attempt["quiz_id"],
                "plan_id": self.plan, "prompt": row["prompt"], "criteria": key["criteria"], "model_answer": key["model_answer"],
                "citation_ids": key["citation_ids"], "answer_text": row["answer"].get("text", ""), "passages": passages,
                "grading_attempts": row["grading_attempts"], "grading_state": row["grading_state"]}

    def fn_charge_quiz_grading(self, p_attempt_id, p_question_id, p_lease_token, p_limit):
        _attempt, row = self.short_row(p_attempt_id, p_question_id, p_lease_token)
        if row["charge_state"] == "charged" and row["charged_lease"] == p_lease_token:
            return {"allowed": True, "used": self.used["grading"], "limit": p_limit, "usage_date": "2026-10-21", "resets_at": "2026-10-22T00:00:00+00:00"}
        if row["grading_attempts"] >= 3:
            raise SqlError("54000", "quiz_grading_exhausted")
        grant = self.consume("grading", p_limit)
        if grant["allowed"]:
            row.update(charge_state="charged", charged_lease=p_lease_token, grading_attempts=row["grading_attempts"] + 1)
        return grant

    def fn_finish_quiz_short_answer(self, p_attempt_id, p_question_id, p_lease_token, p_feedback, p_model, p_unavailable_reason, p_refund):
        _attempt, row = self.short_row(p_attempt_id, p_question_id, p_lease_token, live=False)
        if (p_feedback is None) == (p_unavailable_reason is None):
            raise SqlError("22023", "quiz_invalid_output")
        if p_feedback is not None:
            marks = [c["assessment"] for c in p_feedback["criteria"]]
            result, signal = (("addressed", "positive") if set(marks) == {"addressed"} else
                              ("needs_review", "negative") if "try_again" in marks else ("uncertain", "neutral"))
            if (p_feedback["result"], p_feedback["signal"]) != (result, signal) or len(marks) != len(row["reveal"]["criteria"]):
                raise SqlError("22023", "quiz_invalid_output")
            row.update(grading_state="graded", result=result, signal=signal, model=p_model, unavailable_reason=None, lease_live=False,
                       feedback={k: v for k, v in p_feedback.items() if k not in ("result", "signal")})
            return True
        if p_refund and row["charge_state"] == "charged" and row["charged_lease"] == p_lease_token:
            self.used["grading"] -= 1
            row.update(charge_state="refunded", grading_attempts=max(row["grading_attempts"] - 1, 0))
        row.update(grading_state="unavailable", unavailable_reason=p_unavailable_reason, result="unavailable", signal="neutral", lease_live=False)
        return True
