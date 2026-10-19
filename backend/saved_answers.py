"""One owned answer pipeline shared by the HTTP route and development evaluation."""
import os
from dataclasses import dataclass
from collections.abc import Callable
from typing import Literal
from uuid import UUID

from backend.assistant_models import AssistantInput, AssistantQuestion, AssistantAnswer
from backend.assistant_store import AssistantStore
from backend.assistant_generation import AssistantGenerator
from backend.hybrid_retrieval import HybridRetriever
from backend.sources import SourceGateway

RetrievalMode = Literal['configured', 'legacy', 'hybrid']


@dataclass
class SavedAnswerRun:
    answer: AssistantAnswer
    sources: list[AssistantInput]
    retrieval_mode: Literal['legacy', 'hybrid']


async def answer_saved_question(source_id: UUID, payload: AssistantQuestion, gateway: SourceGateway, *,
                                mode: RetrievalMode = 'configured',
                                generator: AssistantGenerator | None = None,
                                on_retrieval: Callable[[str], None] | None = None,
                                validate_input: Callable[[list[AssistantInput]], None] | None = None) -> SavedAnswerRun:
    if mode not in ('configured', 'legacy', 'hybrid'):
        raise ValueError('Invalid retrieval mode')
    hybrid = mode == 'hybrid' or mode == 'configured' and os.getenv('ENABLE_HYBRID_RETRIEVAL', 'false').lower() == 'true'
    store = AssistantStore(gateway)
    if hybrid:
        inventory = await store.inventory(source_id, payload)
        hits = await HybridRetriever(gateway.client, openai_key=os.getenv('OPENAI_API_KEY', ''),
            qdrant_url=os.getenv('QDRANT_URL', ''), qdrant_key=os.getenv('QDRANT_API_KEY', '')).search(payload.question, gateway.user_id, inventory)
        rows, evidence, snapshots, passage_ranks = await store.hybrid_context(source_id, payload, inventory, hits)
        incomplete = any(s.generation is None for s in inventory)
        if validate_input is not None:
            validate_input(rows)
        if not any(evidence.values()):
            result = AssistantAnswer(status='unsupported', claims=[],
                gap='No indexed saved evidence was found for this question. Some sources may still be preparing for search.',
                references=[], partial=incomplete, source_ids=[r.source_id for r in rows])
        else:
            generator = generator or AssistantGenerator(gateway.client, api_key=os.getenv('OPENAI_API_KEY', ''))
            result = await generator.generate(payload, rows, retrieved=evidence, passage_ranks=passage_ranks, incomplete=incomplete, on_retrieval=on_retrieval)
        await store.validate_hybrid(source_id, payload, snapshots)
    else:
        rows = await store.context(source_id, payload)
        if validate_input is not None:
            validate_input(rows)
        generator = generator or AssistantGenerator(gateway.client, api_key=os.getenv('OPENAI_API_KEY', ''))
        result = await generator.generate(payload, rows, on_retrieval=on_retrieval)
    await store.validate(source_id, payload, rows)
    return SavedAnswerRun(result, rows, 'hybrid' if hybrid else 'legacy')
