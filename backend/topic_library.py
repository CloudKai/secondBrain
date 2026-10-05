"""Rebuild the learner's graph from persisted, source-backed topic analyses."""

from backend.topic_models import TopicLibrary, TopicNode, TopicRecord, TopicConnection, ConnectionDecision


def build_topic_library(
    records: list[TopicRecord], *, partial: bool = False, decisions: list[ConnectionDecision] | None = None
) -> TopicLibrary:
    nodes = {}
    for record in records:
        if not record.analysis:
            continue
        for assignment in record.analysis.topics:
            node = nodes.setdefault(
                assignment.id,
                TopicNode(
                    **assignment.model_dump(
                        include=set(TopicNode.model_fields)
                        - {"source_ids", "uncertain"}
                    ),
                    source_ids=[],
                    uncertain=assignment.uncertain,
                ),
            )
            if record.source_id not in node.source_ids:
                node.source_ids.append(record.source_id)
            groups = sorted(set(node.groups + assignment.groups))
            aliases = sorted(set(node.aliases + assignment.aliases))
            partial = partial or len(groups) > 100 or len(aliases) > 500
            node.groups = groups[:100]
            node.aliases = aliases[:500]
    connections = {}
    rejected = {tuple(sorted((d.source, d.target))) for d in decisions or [] if d.state == "rejected"}
    for record in records:
        if not record.analysis:
            continue
        for relation in record.analysis.relations:
            if tuple(sorted((relation.source, relation.target))) in rejected:
                continue
            a, b = nodes[relation.source], nodes[relation.target]
            support = sorted(set(a.source_ids + b.source_ids), key=str)
            if len(support) < 2 or a.uncertain or b.uncertain:
                continue
            key = f"{a.id}:{relation.kind}:{b.id}"
            connection = connections.setdefault(
                key,
                TopicConnection(
                    id=key,
                    source=a.id,
                    target=b.id,
                    kind=relation.kind,
                    reason=relation.reason
                    + " This describes saved-source coverage, not mastery.",
                    source_ids=support,
                    evidence={},
                ),
            )
            connection.evidence[str(record.source_id)] = relation.citation_ids
    return TopicLibrary(
        maps=records,
        topics=list(nodes.values()),
        connections=list(connections.values()),
        graph_ready=bool(connections)
        or any(len(t.source_ids) >= 2 and not t.uncertain for t in nodes.values()),
        partial=partial
        or any(r.analysis and r.analysis.catalog_partial for r in records),
        connection_decisions=(decisions or [])[:5000],
    )
