"""Owned learning RPC boundary. Postgres controls versions and write leases."""
import json
import os
from uuid import UUID

from backend.learning_models import LearningSnapshot, PreviewContext, FeedbackContext, LearningHistory, LearningCandidates, RevisionContext, LearningGraph, LearningSummary
from backend.study_store import StudyStore, StudyStorageError


class LearningStore:
    def __init__(self, gateway):
        self.transport = StudyStore(gateway.client, gateway.project_url, gateway.headers)
        self.user_id = gateway.user_id

    async def call(self, name: str, **body):
        return await self.transport.request("/rpc/" + name, body=body)

    def snapshot(self, value, source_id: UUID) -> LearningSnapshot:
        try:
            result = LearningSnapshot.model_validate_json(json.dumps(value))
            if result.source_id != source_id or result.user_id != self.user_id:
                raise ValueError("Unexpected learning collection")
            if any(plan.source_id != source_id and not (plan.source_id is None and plan.needs_review) for plan in result.plans):
                raise ValueError("Unexpected learning source")
            plans = {plan.id: plan for plan in result.plans}
            if result.selected_plan_id is not None and (result.selected_plan_id not in plans or result.selected_lesson_index >= len(plans[result.selected_plan_id].content.lessons) or plans[result.selected_plan_id].confirmed_at is None):
                raise ValueError("Unexpected learning place")
            if any(attempt.plan_id not in plans or attempt.difficulty != plans[attempt.plan_id].difficulty
                   or attempt.lesson_index >= len(plans[attempt.plan_id].content.lessons)
                   for attempt in result.attempts):
                raise ValueError("Unexpected practice attempt")
            if any(activity.plan_id not in plans for activity in result.activities):
                raise ValueError("Unexpected learning activity")
            return result
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def read(self, source_id: UUID) -> LearningSnapshot:
        return self.snapshot(await self.call("get_source_learning", p_source_id=str(source_id)), source_id)

    async def summary(self) -> LearningSummary:
        try:
            result = LearningSummary.model_validate_json(json.dumps(await self.call("get_learning_summary")))
            if result.user_id != self.user_id:
                raise ValueError("Unexpected learning owner")
            return result
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def candidates(self, source_id, plan_id):
        try:
            result = LearningCandidates.model_validate_json(json.dumps(await self.call("get_learning_candidates", p_plan_id=str(plan_id))))
            if result.user_id != self.user_id or result.source_id != source_id or result.plan_id != plan_id:
                raise ValueError("Unexpected collection candidates")
            return result
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def revision_context(self, source_id, plan_id, payload):
        try:
            result = RevisionContext.model_validate_json(json.dumps(await self.call("request_learning_revision", p_plan_id=str(plan_id), p_request_id=str(payload.request_id), p_source_id=str(payload.source_id) if payload.source_id else None, p_source_version=payload.source_version, p_difficulty=payload.difficulty, p_goal=payload.goal)))
            members = {item.source.id: item.source for item in result.sources}
            if (result.user_id != self.user_id or result.source_id != source_id or result.request_id != payload.request_id
                    or result.base_plan.id != plan_id or result.base_plan.source_id != source_id
                    or len(members) != len(result.sources) or source_id not in members
                    or payload.source_id is not None and (payload.source_id not in members or members[payload.source_id].source_version != payload.source_version or result.sources[-1].source.id != payload.source_id)
                    or result.mode != ("goal_branch" if payload.goal else "add_source" if payload.source_id else "difficulty")
                    or result.goal != payload.goal
                    or result.difficulty != (payload.difficulty or result.base_plan.difficulty)
                    or any(item.user_id != self.user_id for item in members.values())):
                raise ValueError("Unexpected learning revision")
            return result
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def finish_revision(self, source_id, context, draft=None, evidence=None, model=None):
        await self.finish("finish_learning_revision", p_request_id=str(context.request_id), p_lease_token=str(context.lease_token),
                          p_draft=draft.model_dump(mode="json") if draft else None,
                          p_evidence=[item.model_dump(mode="json") for item in evidence] if evidence else None, p_model=model)
        return await self.read(source_id)

    async def graph(self):
        try:
            result = LearningGraph.model_validate_json(json.dumps(await self.call("get_learning_graph")))
            if result.user_id != self.user_id or len({item.source_id for item in result.collections}) != len(result.collections):
                raise ValueError("Unexpected learning graph")
            return result
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def history(self, offset: int):
        try:
            result = LearningHistory.model_validate_json(json.dumps(await self.call("get_learning_history", p_offset=offset, p_limit=50)))
            if result.user_id != self.user_id or result.next_offset is not None and result.next_offset != offset + 50:
                raise ValueError("Unexpected history page")
            return result
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def preview_context(self, source_id, payload):
        name = "request_learning_capture_preview" if payload.evidence_mode == "capture" else "request_learning_preview"
        value = await self.call(name, p_source_id=str(source_id),
                                p_source_version=payload.source_version, p_request_id=str(payload.request_id),
                                p_goal=payload.goal.strip(), p_difficulty=payload.difficulty,
                                p_path_id=str(payload.path_id) if payload.path_id else None)
        try:
            result = PreviewContext.model_validate_json(json.dumps(value))
            if (result.user_id != self.user_id or result.source.user_id != self.user_id
                    or result.source.id != source_id or result.request_id != payload.request_id
                    or result.source.source_version != payload.source_version or result.evidence_mode != payload.evidence_mode):
                raise ValueError("Unexpected preview context")
            return result
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def finish_preview(self, source_id, context, *, draft=None, goal=None, references=None, model=None, manifest=None, snapshots=None):
        extra = {}
        name = "finish_learning_preview"
        if context.evidence_mode == "capture":
            name = "finish_learning_capture_preview"
            extra = {"p_manifest": manifest.model_dump(mode="json") if manifest else None, "p_sources": snapshots}
        await self.finish(name, p_request_id=str(context.request_id),
                                p_lease_token=str(context.lease_token),
                                p_draft=draft.model_dump(mode="json") if draft else None,
                                p_goal=goal, p_references=[r.model_dump(mode="json") for r in references] if references else None,
                                p_model=model, **extra)
        return await self.read(source_id)

    async def finish(self, name, **body):
        # Learner reads/acceptance remain JWT-scoped. Only generated writes use
        # the server credential and an owned, expiring request lease.
        key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not key:
            raise StudyStorageError()
        transport = StudyStore(self.transport.client, self.transport.url.removesuffix("/rest/v1"),
                               {"apikey": key, "Authorization": f"Bearer {key}"})
        value = await transport.request("/rpc/" + name, body=body)
        if value is not True:
            raise StudyStorageError("stale")

    async def feedback_context(self, source_id, attempt_id, attempt):
        value = await self.call("claim_learning_feedback", p_attempt_id=str(attempt_id))
        try:
            result = FeedbackContext.model_validate_json(json.dumps(value))
            if (result.user_id != self.user_id or result.source_id != source_id or result.attempt_id != attempt_id
                    or result.plan_id != attempt.plan_id or result.response != attempt.response
                    or result.lesson_index != attempt.lesson_index):
                raise ValueError("Unexpected feedback context")
            return result
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc
