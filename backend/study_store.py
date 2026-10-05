"""Postgres RPC boundary shared by authenticated HTTP and server-only workers."""

import json
import logging
from uuid import UUID

import httpx
from pydantic import TypeAdapter

from backend.study_models import (
    StudyDispatch,
    StudyError,
    StudyNote,
    StudyRecord,
    WorkerClaim,
    SectionSummary,
)

logger = logging.getLogger(__name__)
STUDY_COLUMNS = "sections_total,sections_completed,source_version,source_id,user_id,status,attempts,max_attempts,next_attempt_at,error_code,note,updated_at"


class StudyStorageError(Exception):
    def __init__(self, code: str = "unavailable"):
        super().__init__(code)
        self.code = code


class StudyStore:
    def __init__(
        self, client: httpx.AsyncClient, project_url: str, headers: dict[str, str]
    ):
        self.client = client
        self.url = project_url.rstrip("/") + "/rest/v1"
        self.headers = headers

    async def request(
        self, path: str, *, body: dict | None = None, params: dict | None = None
    ):
        response = None
        try:
            response = await self.client.request(
                "POST" if body is not None else "GET",
                self.url + path,
                headers=self.headers,
                json=body,
                params=params,
            )
            if response.is_error:
                code = response.json().get("code")
                if code == "P0002":
                    raise StudyStorageError("not_found")
                if response.status_code in (401, 403):
                    raise StudyStorageError("session")
                raise StudyStorageError()
            return response.json() if response.content else None
        except StudyStorageError:
            raise
        except (httpx.HTTPError, ValueError, TypeError, AttributeError) as exc:
            logger.warning(
                "Study storage %s failed: %s (status=%s)",
                path,
                type(exc).__name__,
                response.status_code if response else None,
            )
            raise StudyStorageError() from exc

    async def accept(self, source_id: UUID, user_id: UUID, retry: bool) -> StudyRecord:
        value = await self.request(
            "/rpc/request_source_study",
            body={"p_source_id": str(source_id), "p_retry": retry},
        )
        return self.owned_record(value, user_id)

    @staticmethod
    def owned_record(value: dict, user_id: UUID) -> StudyRecord:
        try:
            record = StudyRecord.model_validate_json(json.dumps(value))
            if record.user_id != user_id:
                raise ValueError("Unowned study")
            return record
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def list_owned(
        self, user_id: UUID, limit: int, offset: int
    ) -> list[StudyRecord]:
        values = await self.request(
            "/source_studies",
            params={
                "select": STUDY_COLUMNS,
                "user_id": f"eq.{user_id}",
                "order": "source_id.asc",
                "limit": str(limit),
                "offset": str(offset),
            },
        )
        if not isinstance(values, list):
            raise StudyStorageError()
        return [self.owned_record(value, user_id) for value in values]

    async def due(self) -> list[UUID]:
        values = await self.request("/rpc/due_study_dispatches", body={"p_limit": 25})
        try:
            dispatches = TypeAdapter(list[StudyDispatch]).validate_json(
                json.dumps(values)
            )
            return [dispatch.source_id for dispatch in dispatches]
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def acknowledge(self, source_id: UUID) -> None:
        await self.request(
            "/rpc/ack_study_dispatch", body={"p_source_id": str(source_id)}
        )

    async def claim(self, source_id: UUID) -> WorkerClaim | None:
        value = await self.request(
            "/rpc/claim_source_study", body={"p_source_id": str(source_id)}
        )
        try:
            return (
                WorkerClaim.model_validate_json(json.dumps(value))
                if value is not None
                else None
            )
        except ValueError as exc:
            raise StudyStorageError() from exc

    async def finish(
        self,
        claim: WorkerClaim,
        *,
        note: StudyNote | None = None,
        error: StudyError | None = None,
    ) -> bool:
        result = await self.request(
            "/rpc/finish_source_study",
            body={
                "p_source_id": str(claim.source_id),
                "p_lease_token": str(claim.lease_token),
                "p_note": note.model_dump(mode="json") if note else None,
                "p_error_code": error,
            },
        )
        if not isinstance(result, bool):
            raise StudyStorageError()
        return result

    async def plan(self, claim: WorkerClaim, total: int) -> None:
        await self.checkpoint(claim, "plan_source_study", {"p_total": total})

    async def save_section(self, claim: WorkerClaim, index: int, summary: SectionSummary) -> None:
        await self.checkpoint(claim, "save_study_section", {"p_index": index, "p_summary": summary.model_dump(mode="json")})

    async def checkpoint(self, claim: WorkerClaim, name: str, values: dict) -> None:
        result = await self.request("/rpc/" + name, body={
            "p_source_id": str(claim.source_id), "p_source_version": claim.source_version,
            "p_lease_token": str(claim.lease_token), **values,
        })
        if result is False:
            raise StudyStorageError("stale")
        if result is not True:
            raise StudyStorageError()
