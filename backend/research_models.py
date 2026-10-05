"""External further-study resources, separate from saved citation evidence."""
from typing import Literal
from pydantic import Field, HttpUrl, field_validator
from backend.schemas import StrictModel

class ResearchRequest(StrictModel):
    query: str = Field(min_length=1, max_length=500)

    @field_validator('query')
    @classmethod
    def meaningful_query(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('Enter a topic or research question.')
        return value.strip()

class ResearchResource(StrictModel):
    url: HttpUrl
    title: str = Field(min_length=1, max_length=200)
    authors: list[str] = Field(max_length=20)
    organization: str = Field(min_length=1, max_length=200)
    date: str | None = Field(max_length=100)
    kind: Literal['paper', 'documentation', 'university', 'article']
    capture_kind: Literal['article', 'pdf']
    publication_status: Literal['preprint', 'unverified']
    metadata_origin: Literal['source', 'search_index', 'mixed']
    relevance: str = Field(min_length=1, max_length=1000)

class ResearchResults(StrictModel):
    query: str = Field(min_length=1, max_length=500)
    resources: list[ResearchResource] = Field(max_length=6)
    partial: bool
