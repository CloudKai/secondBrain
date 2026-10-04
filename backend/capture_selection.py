"""Validated ranges use original source locations, never inferred locations."""

from pydantic import Field, model_validator
from backend.schemas import StrictModel


class PageRange(StrictModel):
    start: int = Field(ge=1, le=100)
    end: int = Field(ge=1, le=100)

    @model_validator(mode="after")
    def ordered(self):
        if self.end < self.start:
            raise ValueError("The last page must follow the first page.")
        return self


class TimeRange(StrictModel):
    start_ms: int = Field(ge=0, le=604_800_000)
    end_ms: int = Field(gt=0, le=604_800_000)

    @model_validator(mode="after")
    def ordered(self):
        if self.end_ms <= self.start_ms:
            raise ValueError("The end time must follow the start time.")
        return self


def page_selection(start: int | None, end: int | None) -> PageRange | None:
    if start is None and end is None:
        return None
    if start is None or end is None or not 1 <= start <= end <= 100:
        raise ValueError("Choose both first and last PDF pages, between 1 and 100.")
    return PageRange(start=start, end=end)


def time_selection(start: int | None, end: int | None) -> TimeRange | None:
    if start is None and end is None:
        return None
    if start is None or end is None or not 0 <= start < end <= 604_800_000:
        raise ValueError("Choose both start and end times within seven days, with the end after the start.")
    return TimeRange(start_ms=start, end_ms=end)
