"""Bounded locations from a learner-supplied transcript, never inferred times."""

from typing import Literal

from pydantic import Field, model_validator

from backend.schemas import StrictModel
from backend.capture_limits import MAX_CAPTURE_CHARS
from backend.capture_selection import TimeRange


class TranscriptSegment(StrictModel):
    start: int = Field(ge=0, le=MAX_CAPTURE_CHARS)
    end: int = Field(gt=0, le=MAX_CAPTURE_CHARS)
    start_ms: int | None = Field(default=None, ge=0, le=604_800_000)
    end_ms: int | None = Field(default=None, gt=0, le=604_800_000)


class TranscriptDocument(StrictModel):
    provider: Literal["youtube", "teams", "zoom", "panopto"]
    format: Literal["text", "vtt", "srt"]
    filename: str | None = Field(default=None, min_length=1, max_length=200)
    segments: list[TranscriptSegment] = Field(min_length=1, max_length=2_000)
    selected_time: TimeRange | None = None

    @model_validator(mode="after")
    def ordered_segments(self):
        previous_end = -1
        previous_time = -1
        for segment in self.segments:
            if segment.start != previous_end + 1 or segment.end <= segment.start:
                raise ValueError("Invalid transcript text locations")
            if self.format == "text":
                if segment.start_ms is not None or segment.end_ms is not None:
                    raise ValueError("Untimed text cannot invent video times")
            elif (
                segment.start_ms is None
                or segment.end_ms is None
                or segment.end_ms <= segment.start_ms
                or segment.start_ms < previous_time
            ):
                raise ValueError("Invalid transcript cue times")
            if segment.start_ms is not None:
                previous_time = segment.start_ms
            previous_end = segment.end
        if self.format == "text" and len(self.segments) != 1:
            raise ValueError("Untimed text uses one captured span")
        if self.selected_time and (self.format == "text" or any(
            s.start_ms >= self.selected_time.end_ms or s.end_ms <= self.selected_time.start_ms
            for s in self.segments
        )):
            raise ValueError("Selected time must overlap each captured timed cue")
        return self
