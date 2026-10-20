"""Validated collection reads over the existing JWT-scoped learning transport."""
import json
from uuid import UUID

from backend.learning.collection_models import CollectionDetail, CollectionList, CollectionPlaceRequest
from backend.learning.store import LearningStore
from backend.studies.store import StudyStorageError


class CollectionStore:
    def __init__(self, gateway):
        self.learning = LearningStore(gateway)

    def detail(self, value, collection_id: UUID) -> CollectionDetail:
        try:
            result = CollectionDetail.model_validate_json(json.dumps(value))
            if result.user_id != self.learning.user_id or result.collection.id != collection_id:
                raise ValueError("Unexpected collection owner or identity")
            self.learning.snapshot(value["learning"], result.collection.legacy_source_id)
            ids = {source.id for source in result.sources}
            confirmed_paths = {plan.path_id for plan in result.learning.plans if plan.confirmed_at is not None}
            if (len(ids) != len(result.sources) or len(ids) != result.collection.source_count
                    or len(confirmed_paths) != result.collection.path_count):
                raise ValueError("Unexpected collection membership")
            return result
        except (ValueError, TypeError, KeyError) as exc:
            raise StudyStorageError() from exc

    async def read(self, collection_id: UUID) -> CollectionDetail:
        value = await self.learning.call("get_learning_collection", p_collection_id=str(collection_id))
        return self.detail(value, collection_id)

    async def list(self, offset: int) -> CollectionList:
        try:
            value = await self.learning.call("list_learning_collections", p_offset=offset, p_limit=50)
            result = CollectionList.model_validate_json(json.dumps(value))
            if (result.user_id != self.learning.user_id
                    or len({item.id for item in result.collections}) != len(result.collections)
                    or result.next_offset is not None and result.next_offset != offset + 50):
                raise ValueError("Unexpected collection page")
            return result
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def resolve(self, source_id: UUID) -> CollectionDetail:
        value = await self.learning.call("resolve_source_learning_collection", p_source_id=str(source_id))
        try:
            identity = UUID(value["collection"]["id"])
            result = self.detail(value, identity)
            if result.collection.legacy_source_id != source_id:
                raise ValueError("Unexpected legacy source alias")
            return result
        except (ValueError, TypeError, KeyError, AttributeError) as exc:
            raise StudyStorageError() from exc

    async def select(self, collection_id: UUID, plan_id: UUID, payload: CollectionPlaceRequest) -> CollectionDetail:
        value = await self.learning.call("select_learning_collection_lesson", p_collection_id=str(collection_id),
                                        p_plan_id=str(plan_id), p_lesson_index=payload.lesson_index,
                                        p_expected_revision=payload.expected_revision)
        result = self.detail(value, collection_id)
        if (result.learning.selected_plan_id != plan_id or result.learning.selected_lesson_index != payload.lesson_index
                or result.learning.selected_place_revision != payload.expected_revision + 1):
            raise StudyStorageError()
        return result
