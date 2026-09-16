"""Strict API and model-output schemas."""

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ProcessLinkRequest(StrictModel):
    url: HttpUrl
    raw_text: str | None = Field(default=None, max_length=30_000)
    folder_id: str = Field(min_length=1, max_length=128)

    @field_validator("folder_id")
    @classmethod
    def folder_id_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("folder_id must not be blank")
        return value


class ProcessLinkResponse(StrictModel):
    folder_id: str
    source_url: HttpUrl
    raw_text: str
    simplified_summary: str
    mermaid_code: str
    nodes: list["GraphNode"]
    edges: list["GraphEdge"]


class FeynmanSummary(BaseModel):
    """Structured output requested from the simplifier model."""

    model_config = ConfigDict(extra="forbid")
    bullet_points: list[str] = Field(min_length=4, max_length=4)

    @field_validator("bullet_points")
    @classmethod
    def bullets_must_have_content(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip().lstrip("-* ").strip() for item in value]
        if any(not item for item in cleaned):
            raise ValueError("All four bullet points must contain text")
        return cleaned


class GraphNode(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=160)


class GraphEdge(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=64)
    source: str = Field(min_length=1, max_length=64)
    target: str = Field(min_length=1, max_length=64)
    label: str | None = Field(default=None, max_length=80)


class MermaidDiagram(BaseModel):
    """Structured output requested from the visualizer model."""

    model_config = ConfigDict(extra="forbid")
    mermaid_code: str
    nodes: list[GraphNode] = Field(min_length=2, max_length=16)
    edges: list[GraphEdge] = Field(min_length=1, max_length=24)

    @field_validator("mermaid_code")
    @classmethod
    def validate_mermaid(cls, value: str) -> str:
        code = value.strip()
        if code.startswith("```"):
            raise ValueError("Mermaid output must not contain Markdown fences")
        if not code.startswith("graph TD"):
            raise ValueError("Mermaid output must start with 'graph TD'")
        return code

    @model_validator(mode="after")
    def validate_graph_references(self) -> "MermaidDiagram":
        node_ids = [node.id for node in self.nodes]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("Graph node IDs must be unique")
        edge_ids = [edge.id for edge in self.edges]
        if len(edge_ids) != len(set(edge_ids)):
            raise ValueError("Graph edge IDs must be unique")
        known_nodes = set(node_ids)
        if any(
            edge.source not in known_nodes or edge.target not in known_nodes
            for edge in self.edges
        ):
            raise ValueError("Every graph edge must reference an existing node")
        return self
