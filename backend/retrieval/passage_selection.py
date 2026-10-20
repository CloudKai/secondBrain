"""Bounded semantic ordering of exact passages expanded from owned search hits."""
import asyncio
import math
import re
from collections import Counter
from uuid import UUID
import httpx
from backend.retrieval.indexing import EMBEDDING_MODEL, DIMENSIONS
from backend.studies.generation import GenerationFailure
from backend.studies.models import SourceReference

MAX_CANDIDATES = 128
_STOP = {'the', 'a', 'an', 'is', 'are', 'does', 'do', 'why', 'how', 'what', 'of', 'to', 'in', 'and', 'it'}


def select_passages(passages: list[SourceReference], windows: int, *, question: str | None = None) -> list[SourceReference]:
    """Keep bounded caption context while citing each original sentence exactly."""
    anchors = passages[:windows]
    if question:
        # A fused chunk prior can favor related background over literal answer
        # wording. Reserve a small part of the existing budget for term matches;
        # semantic ranking and exact source locations remain authoritative inputs.
        reserve = min(2, windows // 3)
        choices = [*passages[:windows-reserve],
                   *lexical_order(question, passages)[:reserve], *passages]
        anchors = list({(p.start, p.end): p for p in choices}.values())[:windows]
    ordered = sorted(passages,key=lambda p:p.start)
    selected = []
    seen = set()
    used = 0
    for anchor in anchors:
        neighborhood = [anchor]
        if anchor.start_ms is not None:
            index = ordered.index(anchor)
            previous = anchor
            # Forward context resolves "these values" and explanations continued
            # in the next caption. Stop at a gap, 45 seconds or 900 characters.
            for following in ordered[index+1:index+5]:
                if (following.start_ms is None or following.start-previous.end>3
                    or following.start_ms-previous.end_ms>1500
                    or following.end_ms-anchor.start_ms>45000
                    or sum(len(p.excerpt) for p in neighborhood)+len(following.excerpt)>900):
                    break
                neighborhood.append(following)
                previous = following
        for p in neighborhood:
            if (p.start,p.end) not in seen and used+len(p.excerpt)<=windows*1000:
                selected.append(p);seen.add((p.start,p.end));used+=len(p.excerpt)
    return selected


def lexical_order(question: str, passages: list[SourceReference]) -> list[SourceReference]:
    terms = set(re.findall(r'[a-z0-9]+', question.lower())) - _STOP
    return sorted(passages, key=lambda p: -len(terms & set(re.findall(r'[a-z0-9]+', p.excerpt.lower()))))


def embedding_context(passages: list[SourceReference]) -> dict[tuple[int,int],str]:
    # Caption sentences such as "divide these values" need their nearby
    # explanation for ranking. Neighbors are ranking context only: returned
    # citations still use the original exact sentence/cue span.
    ordered = sorted(passages, key=lambda p:p.start)
    result = {}
    for index,p in enumerate(ordered):
        text = p.excerpt
        if p.start_ms is not None:
            previous = ordered[index-1] if index else None
            following = ordered[index+1] if index+1<len(ordered) else None
            if previous and previous.end_ms is not None and 0<=p.start-previous.end<=3 and p.start_ms-previous.end_ms<=1500:
                text = previous.excerpt+'\n'+text
            if following and following.start_ms is not None and 0<=following.start-p.end<=3 and following.start_ms-p.end_ms<=1500:
                text += '\n'+following.excerpt
        result[p.start,p.end] = text
    return result


async def rank_passages(client: httpx.AsyncClient, api_key: str, question: str,
                        evidence: dict[UUID,list[SourceReference]],
                        passage_ranks: dict[tuple[UUID,int,int],int] | None = None) -> dict[UUID,list[SourceReference]]:
    # Interleave sources so a long current note cannot consume the entire batch.
    # Lexical preselection retains late literal matches before the bounded batch.
    groups = {sid: lexical_order(question, passages) for sid, passages in evidence.items()}
    contexts = {sid:embedding_context(passages) for sid,passages in groups.items()}
    candidates = []
    for index in range(max((len(v) for v in groups.values()), default=0)):
        for sid, passages in groups.items():
            if index < len(passages) and len(candidates) < MAX_CANDIDATES:
                candidates.append((sid, passages[index]))
        if len(candidates) == MAX_CANDIDATES:
            break
    if not candidates:
        return groups
    try:
        if not api_key or api_key == 'replace-me':
            raise GenerationFailure('setup_required')
        if len(question)>2000 or any(not 0<len(p.excerpt)<=1000 for _,p in candidates):
            raise ValueError('Invalid passage bounds')
        async with asyncio.timeout(10):
            response = await client.post('https://api.openai.com/v1/embeddings',
                headers={'Authorization':'Bearer '+api_key},
                json={'model':EMBEDDING_MODEL,'dimensions':DIMENSIONS,
                      'input':[question, *[contexts[sid][p.start,p.end] for sid,p in candidates]]}, timeout=10)
            response.raise_for_status()
            data=response.json()['data']
        if len(data)!=len(candidates)+1 or any(type(v['index']) is not int for v in data) or Counter(v['index'] for v in data)!=Counter(range(len(data))):
            raise ValueError('Invalid embedding identities')
        vectors={}
        for item in data:
            vector=item['embedding']
            if len(vector)!=DIMENSIONS or any(type(v) not in (int,float) or not math.isfinite(v) for v in vector):
                raise ValueError('Invalid passage embedding')
            norm=math.sqrt(sum(v*v for v in vector))
            if not norm or not math.isfinite(norm):
                raise ValueError('Empty passage embedding')
            vectors[item['index']]=[v/norm for v in vector]
        scores={(sid,p.start,p.end):sum(a*b for a,b in zip(vectors[0],vectors[i+1]))
                for i,(sid,p) in enumerate(candidates)}
        if passage_ranks is not None:
            # Keep a bounded prior from the fused chunk search. Sentence-only
            # similarity can confuse mathematical scaling with scaling capacity.
            # This development weight is not a calibrated relevance threshold.
            for key in scores:
                scores[key] += 0.2/(1+passage_ranks[key])
        # Stable sort keeps lexical/chunk order for exact ties. Unembedded
        # candidates stay last and retain their original immutable locators.
        return {sid:sorted(passages,key=lambda p:-scores.get((sid,p.start,p.end),-2))
                for sid,passages in groups.items()}
    except (TimeoutError,httpx.HTTPError) as exc:
        raise GenerationFailure('provider_unavailable') from exc
    except (ValueError,TypeError,KeyError,AttributeError,OverflowError) as exc:
        raise GenerationFailure('invalid_output') from exc
