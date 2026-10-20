"""Native tests (standard library only) for backend/quiz/messages.py."""

import json
import re
import unittest
from pathlib import Path

from backend.quiz.messages import QUIZ_MESSAGES, quiz_message

CODES = json.loads((Path(__file__).parent / "fixtures" / "quiz_error_codes.json").read_text(encoding="utf-8"))
EXEMPT = "not proof of mastery"
BANNED = re.compile(
    r"\b(mastered|mastery|passed|failed|fail|fails|failure|streak|badge|badges|xp|points?|level[- ]?up|"
    r"leaderboard|achievement|achievements|reward|rewards|unlock|unlocked|trophy|trophies|rank|ranked)\b",
    re.IGNORECASE,
)


class QuizMessagesTests(unittest.TestCase):
    def test_keys_equal_the_shared_error_codes(self):
        self.assertEqual(set(QUIZ_MESSAGES), {item["code"] for item in CODES})
        self.assertEqual(len(CODES), len({item["code"] for item in CODES}))

    def test_no_verdict_or_gamification_words(self):
        for code, message in QUIZ_MESSAGES.items():
            cleaned = message.lower().replace(EXEMPT, "")
            self.assertIsNone(BANNED.search(cleaned), (code, message))

    def test_messages_are_plain_english(self):
        for code, message in QUIZ_MESSAGES.items():
            self.assertTrue(message.strip() and message == message.strip(), code)
            self.assertLessEqual(len(message), 300, code)
            self.assertNotRegex(message, r"\bp\d{4}\b|[0-9a-f]{8}-[0-9a-f]{4}|Traceback|openai|OpenAI|Supabase|Postgres|SQL", code)
            self.assertNotIn("quiz_", message, code)

    def test_placeholders_are_only_limit(self):
        for code, message in QUIZ_MESSAGES.items():
            self.assertLessEqual(set(re.findall(r"\{(\w+)\}", message)), {"limit"}, code)

    def test_quiz_message_fills_placeholders_and_falls_back(self):
        self.assertIn("3 quiz generations", quiz_message("quiz_generation_limit_reached", limit=3))
        self.assertNotIn("{", quiz_message("quiz_generation_limit_reached"))
        self.assertNotIn("{", quiz_message("quiz_grading_limit_reached", limit=20))
        self.assertTrue(quiz_message("quiz_not_found"))
        self.assertTrue(quiz_message("something_unknown"))

    def test_the_ban_list_would_catch_a_violation(self):
        for text in ("You mastered it", "You passed", "This failed", "A new badge", "Earn points"):
            self.assertIsNotNone(BANNED.search(text.lower()), text)


if __name__ == "__main__":
    unittest.main()
