"""Synchronous learner questions against current owned saved evidence."""
import os
import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from backend.sources import SourceGateway, owned_sources
from backend.study_store import StudyStorageError
from backend.study_generation import GenerationFailure
from backend.assistant_models import AssistantQuestion, AssistantAnswer
from backend.assistant_store import AssistantStore
from backend.assistant_generation import AssistantGenerator

logger = logging.getLogger(__name__)

router=APIRouter(prefix='/api/v2/sources',tags=['saved study assistant'])


@router.post('/{source_id}/ask', response_model=AssistantAnswer)
async def ask(source_id:UUID, payload:AssistantQuestion, gateway:SourceGateway=Depends(owned_sources)):
    try:
        store=AssistantStore(gateway)
        rows=await store.context(source_id,payload)
        result=await AssistantGenerator(gateway.client,api_key=os.getenv('OPENAI_API_KEY','')).generate(payload,rows)
        await store.validate(source_id,payload,rows)
        return result
    except StudyStorageError as exc:
        status={'not_found':404,'session':401,'stale':409}.get(exc.code,503)
        detail='Saved evidence changed or is unavailable. Reload the note and ask again.' if status in (404,409) else 'The assistant cannot retrieve your library. Retry after checking its setup.'
        raise HTTPException(status,detail) from exc
    except GenerationFailure as exc:
        logger.warning("Study assistant generation failed: %s", exc.code)
        raise HTTPException(503,'The assistant could not produce a grounded answer. Check provider setup or retry.') from exc
