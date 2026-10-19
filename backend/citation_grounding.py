"""Normalize redundant model metadata without discarding unknown attribution."""
import re


def citation_prose(text: str, reference_ids: set[str], literal_labels: set[str], *,
                   source_markers: dict[str, set[str]] | None = None) -> str:
    # Only remove parenthesized labels already present in this claim's metadata.
    # Source quotations containing those words remain verbatim.
    def marker(match: re.Match[str]) -> str:
        labels = set(re.findall(r'\bref\d+\b', match.group()))
        return '' if labels <= reference_ids and not labels & literal_labels else match.group()

    result = text
    if source_markers is not None:
        def source_marker(match: re.Match[str]) -> str:
            groups = match.group().strip()[1:-1].split(';')
            if set(re.findall(r'\b(?:source|ref)\d+\b', match.group())) & literal_labels:
                return match.group()
            for group in groups:
                key, _, refs = group.strip().partition(':')
                if not _:
                    key, _, refs = group.strip().partition(',')
                key = key.strip()
                labels = set(re.findall(r'\bref\d+\b', refs))
                if key not in source_markers or not labels <= source_markers[key]:
                    raise ValueError('Unknown or mismatched source marker')
            return ''
        source_group = r'source\d+(?:\s*[:,]\s*ref\d+(?:\s*,\s*ref\d+)*)?'
        result = re.sub(r'\s*\(' + source_group + r'(?:\s*;\s*' + source_group + r')*\)', source_marker, result)
        if not set(re.findall(r'\bsource\d+\b', result)) <= literal_labels:
            raise ValueError('Private source label in prose')
    result = re.sub(r'\s*\(ref\d+(?:\s*[,;]\s*ref\d+)*\)', marker, result)
    if not set(re.findall(r'\bref\d+\b', result)) <= literal_labels:
        raise ValueError('Private citation label in prose')
    return result
