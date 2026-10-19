"""Safe, bounded feedback for correcting a rejected structured model draft."""

import json
from pydantic import ValidationError


def repair_payload(payload: str, error: ValueError | TypeError | KeyError) -> str:
    # Do not include Pydantic input dumps: validation feedback describes the
    # contract, while the original bounded evidence remains the only source.
    reasons = (
        [f'{".".join(str(part) for part in e["loc"]) or "$"}: {e["msg"]}'
         for e in error.errors(include_input=False, include_url=False)]
        if isinstance(error, ValidationError) else [str(error)]
    )
    return json.dumps({
        'input': json.loads(payload),
        'validation_feedback': reasons[:8],
        'instruction': 'Regenerate once using only the original evidence. Correct these contract errors; do not invent evidence or add unsupported citations to satisfy validation.',
    }, ensure_ascii=False)
