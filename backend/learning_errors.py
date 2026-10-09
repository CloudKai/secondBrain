"""Shared storage failure policy for legacy and collection learning routes."""
from fastapi import HTTPException

from backend.study_store import StudyStorageError


def storage_failure(error: StudyStorageError):
    if error.code == "not_found":
        return HTTPException(404, "This source or learning path is no longer available.")
    if error.code == "stale":
        return HTTPException(409, "The source or learning plan changed. Reload before continuing.")
    if error.code == "session":
        return HTTPException(401, "Your library session expired. Retry connecting.")
    if error.code == "busy":
        return HTTPException(409, "A learning request is still running. Wait a moment, then reload or retry.")
    if error.code == "limit":
        return HTTPException(429, "This learning request reached its retry or generation limit. Review saved progress; try a new request later.")
    return HTTPException(503, "Learning storage is unavailable. Check the learning migration and retry.")
