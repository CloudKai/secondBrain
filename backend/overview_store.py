"""Topic-overview RPC boundary shared by learners and workers."""

import json
from uuid import UUID
from backend.study_store import StudyStore, StudyStorageError
from backend.overview_models import OverviewSnapshot, OverviewView, OverviewClaimJob, TopicOverview
from backend.study_models import StudyError


class OverviewStore:
    def __init__(self, client, project_url, headers):
        self.transport = StudyStore(client, project_url, headers)

    async def snapshot(
        self, topic_id: UUID, view: OverviewView | None = None, *, user_id: UUID
    ):
        body = {"p_topic_id": str(topic_id)}
        if view:
            body.update(p_view_mode=view.view_mode, p_retry=view.retry)
        value = await self.transport.request(
            "/rpc/" + ("set_topic_overview_view" if view else "get_topic_overview"),
            body=body,
        )
        try:
            result = OverviewSnapshot.model_validate_json(json.dumps(value))
            if (
                result.topic_id != topic_id
                or result.record
                and (
                    result.record.user_id != user_id
                    or result.record.topic_id != topic_id
                )
            ):
                raise ValueError("Unexpected topic")
            return result
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def due(self) -> list[UUID]:
        values = await self.transport.request(
            "/rpc/due_overview_dispatches", body={"p_limit": 25}
        )
        try:
            return [UUID(v["id"]) for v in values]
        except (ValueError, TypeError, KeyError) as exc:
            raise StudyStorageError() from exc

    async def acknowledge(self, job_id: UUID):
        await self.transport.request(
            "/rpc/ack_overview_dispatch", body={"p_id": str(job_id)}
        )

    async def claim(self, job_id: UUID) -> OverviewClaimJob | None:
        value = await self.transport.request(
            "/rpc/claim_topic_overview", body={"p_id": str(job_id)}
        )
        try:
            return (
                OverviewClaimJob.model_validate_json(json.dumps(value))
                if value is not None
                else None
            )
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def finish(self, claim: OverviewClaimJob, *, overview: TopicOverview | None = None, error: StudyError | None = None) -> bool:
        value = await self.transport.request(
            "/rpc/finish_topic_overview",
            body={
                "p_id": str(claim.id),
                "p_lease_token": str(claim.lease_token),
                "p_overview": overview.model_dump(mode="json") if overview else None,
                "p_error_code": error,
            },
        )
        if not isinstance(value, bool):
            raise StudyStorageError()
        return value
