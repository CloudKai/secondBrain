"""Topic map persistence across the learner and server-only worker boundaries."""

import json
from uuid import UUID
from backend.study_store import StudyStore, StudyStorageError
from backend.topic_models import TopicRecord, TopicClaim, TopicAnalysis, TopicPlacement

COLUMNS = "source_id,user_id,status,attempts,max_attempts,next_attempt_at,error_code,analysis,updated_at"


class TopicStore:
    def __init__(self, client, project_url, headers):
        self.transport = StudyStore(client, project_url, headers)

    async def list_owned(self, user_id: UUID, limit: int = 501):
        values = await self.transport.request(
            "/source_topic_maps",
            params={
                "select": COLUMNS,
                "user_id": f"eq.{user_id}",
                "order": "source_id.asc",
                "limit": str(limit),
            },
        )
        try:
            if not isinstance(values, list):
                raise ValueError("Invalid map list")
            return [self.record(value, user_id) for value in values]
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def accept(self, source_id: UUID, user_id: UUID, retry: bool = False):
        value = await self.transport.request(
            "/rpc/request_source_topics",
            body={"p_source_id": str(source_id), "p_retry": retry},
        )
        return self.record(value, user_id)

    @staticmethod
    def record(value, user_id: UUID):
        try:
            record = TopicRecord.model_validate_json(json.dumps(value))
            if record.user_id != user_id:
                raise ValueError("Unowned map")
            return record
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def due(self):
        values = await self.transport.request(
            "/rpc/due_topic_dispatches", body={"p_limit": 25}
        )
        try:
            return [UUID(v["source_id"]) for v in values]
        except (ValueError, KeyError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def acknowledge(self, source_id):
        await self.transport.request(
            "/rpc/ack_topic_dispatch", body={"p_source_id": str(source_id)}
        )

    async def claim(self, source_id):
        value = await self.transport.request(
            "/rpc/claim_source_topics", body={"p_source_id": str(source_id)}
        )
        try:
            return (
                TopicClaim.model_validate_json(json.dumps(value))
                if value is not None
                else None
            )
        except ValueError as exc:
            raise StudyStorageError() from exc

    async def finish(
        self, claim: TopicClaim, *, analysis: TopicAnalysis | None = None, error=None
    ):
        result = await self.transport.request(
            "/rpc/finish_source_topics",
            body={
                "p_source_id": str(claim.source_id),
                "p_lease_token": str(claim.lease_token),
                "p_analysis": analysis.model_dump(mode="json") if analysis else None,
                "p_error_code": error,
            },
        )
        if not isinstance(result, bool):
            raise StudyStorageError()
        return result

    async def placement(self, source_id, user_id, payload: TopicPlacement):
        value = await self.transport.request(
            "/rpc/confirm_topic_placement",
            body={
                "p_source_id": str(source_id),
                "p_topic_id": str(payload.topic_id),
                "p_target_id": str(payload.target_id) if payload.target_id else None,
            },
        )
        return self.record(value, user_id)
