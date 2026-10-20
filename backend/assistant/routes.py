"""Synchronous learner questions against current owned saved evidence."""
import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from backend.sources.routes import SourceGateway, owned_sources
from backend.studies.store import StudyStorageError
from backend.studies.generation import GenerationFailure
from backend.assistant.models import AssistantQuestion, AssistantAnswer
from backend.assistant.answers import answer_saved_question

logger = logging.getLogger(__name__)

router=APIRouter(prefix='/api/v2/sources',tags=['saved study assistant'])


@router.post('/{source_id}/ask', response_model=AssistantAnswer)
async def ask(source_id:UUID, payload:AssistantQuestion, gateway:SourceGateway=Depends(owned_sources)):
    try:
        run=await answer_saved_question(source_id,payload,gateway)
        return run.answer
    except StudyStorageError as exc:
        status={'not_found':404,'session':401,'stale':409}.get(exc.code,503)
        detail='Saved evidence changed or is unavailable. Reload the note and ask again.' if status in (404,409) else 'The assistant cannot retrieve your library. Retry after checking its setup.'
        raise HTTPException(status,detail) from exc
    except GenerationFailure as exc:
        logger.warning("Study assistant generation failed: %s", exc.code)
        raise HTTPException(503,'The assistant could not produce a grounded answer. Check provider setup or retry.') from exc
