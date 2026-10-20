# Product decisions (agreed with the owner, 2026-10-20)

These are target decisions for the next phase of work. They are not verified
current behavior. Follow `AGENTS.md` for the rule that roadmap items must be
labeled separately from the verified MVP.

## Priority
- Web (`web/`) is the primary client. Mobile (`mobile/`) is out of scope until asked.

## Product direction
Evolve Second Brain from MVP into a guided learning product that:
1. Captures the learner's overall goal and context (what they are trying to learn).
2. Shows how topics and sources connect, and explains how the content works as a whole.
3. Recommends what to learn next, both inside the library and as deeper outside resources.
4. Ends each topic with a quiz (with feedback) so the learner can check understanding.

## Design direction
- Calm and minimal. Easy to understand, not overwhelming.
- Generous whitespace, restrained palette, one clear primary action per screen.
- Use emphasis deliberately: highlight the few points the learner should focus on
  (key ideas, "start here", "next step") rather than decorating everything.
- Dark mode is required, alongside light mode. Use design tokens for both themes
  and respect the system preference with a manual toggle.
- Accessible contrast in both themes.

## AI usage and cost limits
- Provider is OpenAI.
- Generation must be bounded. Set explicit, configurable limits (per request output
  size, per user per day or per month generation counts, and quiz/recommendation
  caps). Defaults are chosen by the implementer and documented.
- Cache or persist generated output (notes, quizzes, recommendations) so it is not
  regenerated on every view. Regenerate only on explicit request or source change.
- Show the user a clear message when a limit is reached; never fail silently.
- All limits live in server-side configuration; the browser never holds API keys.

## Model policy (decided 2026-10-20)
Both models are confirmed to exist in OpenAI's public docs.
- Default for quizzes, recommendations, and routine generation: `gpt-6-luna`
  (about $0.10 input / $0.50 output per 1M tokens).
- Escalate to `gpt-6.1-sol` (about $2 / $10 per 1M tokens, roughly 20x the cost)
  only as a fallback when Luna output fails validation, or for tasks where
  quality clearly matters more than cost (for example grading free-text answers).
- Do not use Sol as the default for high-volume work.
- Model ids and limits must be configurable through server-side settings,
  not hard-coded in several places.

## Process decisions
- Never commit directly to `main`. Work on a feature branch; commit locally.
  Do not push unless the owner asks.
- Network note: the build sandbox cannot reach npm or PyPI, so `npm install`,
  typecheck, lint, build, and tests cannot run there. Code must be written
  conservatively and the owner runs the checks locally. Never claim a check
  passed if it was not run.
