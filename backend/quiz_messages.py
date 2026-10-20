"""Every learner-visible server string for the quiz, keyed by error code.

Standard library only. Messages are plain English: no provider text, no ids, no
stack, and no verdict language. The keys equal the codes in
backend/tests/fixtures/quiz_error_codes.json (a test pins that).
"""

QUIZ_MESSAGES: dict[str, str] = {
    "quiz_generation_limit_reached": "You've used all {limit} quiz generations for today. You can still take your current quiz, and new questions are available after the daily reset.",
    "quiz_grading_limit_reached": "You've used all {limit} AI-feedback requests for today. Your answers and the model answers are still shown, and feedback is available again after the daily reset.",
    "quiz_attempt_limit_reached": "This quiz has reached its limit of 20 attempts. Generate new questions to keep practising.",
    "quiz_plan_cap_reached": "This path already has 20 saved quizzes. Remove the path or keep using one of the existing quizzes.",
    "quiz_generation_attempts_capped": "Too many quiz generations for this path did not finish today. Try again tomorrow.",
    "quiz_grading_exhausted": "AI feedback was already tried three times for this answer. Compare your answer with the model answer shown below.",
    "quiz_not_ready": "This path does not have enough cited material for a quiz yet.",
    "quiz_request_invalid": "That request was not understood. Reload the page and try again.",
    "quiz_answer_invalid": "One of your answers could not be used. Check your answers and try again.",
    "quiz_not_found": "This quiz or path is no longer available.",
    "quiz_plan_not_current": "This path was replaced by a newer version. Open the current version to take a quiz.",
    "quiz_evidence_changed": "The sources behind this path changed. Review the path first, then try again.",
    "quiz_generation_in_progress": "A quiz is already being prepared. Wait a moment, then reload.",
    "quiz_attempt_in_progress": "Your answers are still being checked. Wait a moment, then reload.",
    "quiz_grading_busy": "AI feedback for this answer is already being prepared. Wait a moment, then reload.",
    "quiz_lease_lost": "This request took too long and was released. You can retry it.",
    "quiz_request_changed": "That request does not match the earlier one. Reload the page and try again.",
    "quiz_request_exhausted": "That request was tried several times. Start again to make a new request.",
    "quiz_attempt_conflict": "These answers do not match an earlier submission. Reload the page and try again.",
    "quiz_generation_unavailable": "The quiz could not be prepared right now. Try again in a few minutes.",
    "quiz_disabled": "Creating new quiz questions and AI feedback are switched off for now. Your saved quiz still works.",
    "quiz_storage_unavailable": "Quiz storage is unavailable. Check the quiz migration and try again.",
    "quiz_session_expired": "Your library session expired. Reconnect and try again.",
}

_FALLBACK = "Something went wrong with the quiz. Try again."


def quiz_message(code: str, **values: object) -> str:
    """The message for `code`, filling `{limit}`-style placeholders when given."""
    text = QUIZ_MESSAGES.get(code, _FALLBACK)
    for name, value in values.items():
        text = text.replace("{" + name + "}", str(value))
    return text.replace("{limit}", "daily").replace("{used}", "")
