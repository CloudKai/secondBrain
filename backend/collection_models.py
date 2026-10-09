"""Owned collection contracts, preserving the legacy learning snapshot."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from backend.learning_models import LearningSnapshot
from backend.schemas import StrictModel


class CollectionSummary(StrictModel):
    id: UUID
    legacy_source_id: UUID
    title: str = Field(min_length=1, max_length=200)
    goal: str = Field(max_length=500)
    revision: int = Field(ge=1)
    source_count: int = Field(ge=0)
    path_count: int = Field(ge=0)
    original_source_available: bool
    created_at: datetime
    updated_at: datetime


class CollectionSource(StrictModel):
    id: UUID
    title: str = Field(min_length=1, max_length=200)
    source_kind: Literal["article", "pdf", "video"]
    source_version: int = Field(ge=1, le=20)


class CollectionDetail(StrictModel):
    user_id: UUID = Field(exclude=True)
    collection: CollectionSummary
    sources: list[CollectionSource] = Field(max_length=200)
    learning: LearningSnapshot


class CollectionList(StrictModel):
    user_id: UUID = Field(exclude=True)
    collections: list[CollectionSummary] = Field(max_length=50)
    next_offset: int | None = Field(ge=0)


class CollectionPlaceRequest(StrictModel):
    lesson_index: int = Field(ge=0, le=3)
    expected_revision: int = Field(ge=0)
