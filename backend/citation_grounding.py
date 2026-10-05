"""Normalize redundant model metadata without discarding unknown attribution."""
import re


def citation_prose(text: str, reference_ids: set[str], literal_labels: set[str]) -> str:
    # Only remove parenthesized labels already present in this claim's metadata.
    # Source quotations containing those words remain verbatim.
    def marker(match: re.Match[str]) -> str:
        labels = set(re.findall(r'\bref\d+\b', match.group()))
        return '' if labels <= reference_ids and not labels & literal_labels else match.group()

    result = re.sub(r'\s*\(ref\d+(?:\s*[,;]\s*ref\d+)*\)', marker, text)
    if not set(re.findall(r'\bref\d+\b', result)) <= literal_labels:
        raise ValueError('Private citation label in prose')
    return result
