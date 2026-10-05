"""Authenticated, explicit discovery requests. Saving uses existing source routes."""
import logging
import os
from fastapi import APIRouter, Depends, HTTPException
from backend.sources import SourceGateway, owned_sources
from backend.research_models import ResearchRequest, ResearchResults
from backend.research_provider import discover_resources, ResearchFailure

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/api/v2', tags=['further-study discovery'])

@router.post('/research', response_model=ResearchResults)
async def research(payload: ResearchRequest, gateway: SourceGateway = Depends(owned_sources)):
    try:
        return await discover_resources(gateway.client, payload.query, os.getenv('OPENAI_API_KEY', ''))
    except ResearchFailure as exc:
        logger.warning('Research discovery failed: %s', str(exc))
        raise HTTPException(503, 'Research search is unavailable. Check the server search setup or retry. No sources were saved.') from exc
