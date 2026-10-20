"""A bounded AI-generated map of selected evidence, not exhaustive coverage."""
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field
from backend.core.schemas import StrictModel


class TeachingManifestEntry(StrictModel):
    kind: Literal['concept', 'prerequisite', 'example', 'qualification']
    text: str = Field(min_length=1, max_length=500)
    citation_ids: list[Annotated[str, Field(min_length=1, max_length=16)]] = Field(min_length=1, max_length=10)


class TeachingManifest(StrictModel):
    policy_version: Literal['teaching_manifest_v1']
    coverage: str = Field(min_length=1, max_length=1000)
    gaps: list[Annotated[str, Field(min_length=1, max_length=500)]] = Field(max_length=5)
    entries: list[TeachingManifestEntry] = Field(min_length=1, max_length=24)

    def validate_citations(self, ids: set[str]):
        if any(not set(entry.citation_ids) <= ids for entry in self.entries):
            raise ValueError('Manifest uses unknown evidence')


class TeachingMetadata(StrictModel):
    selector_policy: Literal['teaching_evidence_v1']
    source_id: UUID
    source_version: int = Field(ge=1, le=20)
    capture_sha256: str = Field(pattern=r'^[a-f0-9]{64}$')
    index_generation: UUID
    manifest: TeachingManifest
