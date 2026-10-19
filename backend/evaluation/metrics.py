"""Local score-only metrics with a shared, conservative judge budget."""
import json
import os
# Set before importing the optional SDK; no hosted telemetry or automatic retry.
os.environ['DEEPEVAL_TELEMETRY_OPT_OUT'] = '1'
os.environ['DEEPEVAL_RETRY_MAX_ATTEMPTS'] = '1'
from deepeval.models import GPTModel
from deepeval.metrics import FaithfulnessMetric, ContextualRecallMetric, ContextualPrecisionMetric


class BudgetJudge(GPTModel):
    def __init__(self, model: str, budget_usd: float):
        if not 0 < budget_usd <= 5:
            raise ValueError('Development judge budget must be greater than zero and at most $5')
        super().__init__(model=model, generation_kwargs={'max_tokens': 1000}, timeout=30, max_retries=0)
        self.budget_usd = budget_usd
        self.reserved_usd = 0.0
        self.reported_usd = 0.0
        self.calls = 0

    async def a_generate(self, prompt, schema=None):
        prices = self.model_data
        if not prices.input_price or not prices.output_price:
            raise ValueError('Judge model needs known SDK token prices')
        schema_text = json.dumps(schema.model_json_schema()) if schema else ''
        # UTF-8 bytes upper-bound text token count; include format/schema and
        # envelope margin, and reserve maximum output before sending a request.
        reserve = (len((prompt + schema_text).encode()) + 1000) * prices.input_price + 1000 * prices.output_price
        if self.calls >= 12 or self.reserved_usd + reserve > self.budget_usd:
            raise ValueError('Development judge call/cost budget exhausted')
        self.calls += 1
        self.reserved_usd += reserve
        result, cost = await super().a_generate(prompt, schema)
        # Keep the conservative reservation even after success; an error could
        # otherwise lead to overspending through unaccounted provider work.
        self.reported_usd += cost
        return result, cost


def metrics(judge, *, has_expected_output: bool):
    result = [FaithfulnessMetric(model=judge, threshold=None, eval_mode='llm')]
    if has_expected_output:
        result.extend([ContextualRecallMetric(model=judge, threshold=None, eval_mode='llm'),
                       ContextualPrecisionMetric(model=judge, threshold=None, eval_mode='llm')])
    return result
