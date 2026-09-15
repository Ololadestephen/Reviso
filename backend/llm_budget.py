"""Count every provider round-trip, including schema repairs."""

from contextlib import contextmanager
from contextvars import ContextVar

from backend.storage import DuplicateLlmRequest, LlmAllowanceExceeded, LlmLimits, Repository

_consume: ContextVar[object | None] = ContextVar("llm_consume", default=None)


def note_provider_request(count: int = 1) -> None:
    consume = _consume.get()
    if consume is not None:
        consume(count)


@contextmanager
def track_llm_usage(repo: Repository, owner_id: str, request_key: str, limits: LlmLimits):
    repo.acquire_llm_slot(owner_id, request_key, limits)

    def consume(count: int) -> None:
        repo.consume_llm_allowance(owner_id, count, limits)

    token = _consume.set(consume)
    try:
        yield
    finally:
        _consume.reset(token)
        repo.release_llm_slot(owner_id, request_key)


__all__ = [
    "DuplicateLlmRequest",
    "LlmAllowanceExceeded",
    "LlmLimits",
    "note_provider_request",
    "track_llm_usage",
]
