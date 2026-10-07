"""Safe provider failure details: never expose response bodies or credentials."""

import logging
import re
from decimal import ROUND_CEILING, Decimal

import httpx

logger = logging.getLogger(__name__)
MAX_RETRY_SECONDS = 86400
ACCESS_MESSAGE = (
    "The AI service could not authorize this request. Its key or access settings need checking."
)
MODEL_MESSAGE = "The configured AI model is unavailable. Its model setting needs checking."
TEMPORARY_MESSAGE = "The AI service is temporarily unavailable. Try again later."
REJECTED_MESSAGE = "The AI service rejected this request. Its request settings need checking."
HTTP_MESSAGES = {
    401: ACCESS_MESSAGE,
    403: ACCESS_MESSAGE,
    404: MODEL_MESSAGE,
    413: "This research context is too large for the AI service. Its context limit needs checking.",
    498: TEMPORARY_MESSAGE,
}
REQUEST_CODE_MESSAGES = {
    "json_validate_failed": "The AI service could not format its answer. Try again or continue with the saved findings.",
    "model_not_found": MODEL_MESSAGE,
    "model_decommissioned": MODEL_MESSAGE,
}
SAFE_ERROR_CODES = frozenset(
    {
        "json_validate_failed",
        "rate_limit_exceeded",
        "model_not_found",
        "model_decommissioned",
        "model_permission_blocked",
        "invalid_api_key",
        "insufficient_quota",
    }
)


class LLMUnavailableError(Exception):
    """The configured model cannot currently answer, with safe retry metadata."""

    def __init__(
        self,
        message: str,
        *,
        upstream_status: int | None = None,
        retry_after: int | None = None,
    ):
        super().__init__(message)
        self.upstream_status = upstream_status
        self.retry_after = retry_after


def retry_seconds(value: str | None) -> int | None:
    """Accept bounded provider seconds, rounding up rather than retrying early."""
    if value is None or not re.fullmatch(r"\d{1,6}(?:\.\d{1,3})?", value):
        return None
    seconds = int(Decimal(value).to_integral_value(rounding=ROUND_CEILING))
    return max(1, seconds) if seconds <= MAX_RETRY_SECONDS else None


def safe_error_code(response: httpx.Response) -> str | None:
    try:
        body = response.json()
    except ValueError:
        return None
    error = body.get("error") if isinstance(body, dict) else None
    code = error.get("code") if isinstance(error, dict) else None
    return code if isinstance(code, str) and code in SAFE_ERROR_CODES else None


def failure_message(status: int, code: str | None, retry_after: int | None) -> str:
    """Translate known failure categories without copying upstream wording."""
    if status == 429:
        retry = (
            f" Try again in {retry_after} seconds."
            if retry_after is not None
            else " Try again later; the service did not give a retry time."
        )
        return "The AI service has reached its request limit." + retry
    if status in HTTP_MESSAGES:
        return HTTP_MESSAGES[status]
    if status >= 500:
        return TEMPORARY_MESSAGE
    if status == 400:
        return REQUEST_CODE_MESSAGES.get(code, REJECTED_MESSAGE)
    return REJECTED_MESSAGE


def provider_http_failure(
    response: httpx.Response, *, provider: str, model: str
) -> LLMUnavailableError:
    status = response.status_code
    code = safe_error_code(response)
    retry_after = retry_seconds(response.headers.get("retry-after")) if status == 429 else None
    message = failure_message(status, code, retry_after)
    logger.warning(
        "AI provider HTTP failure provider=%s model=%s status=%s code=%s retry_after=%s",
        provider,
        model,
        status,
        code or "unclassified",
        retry_after,
    )
    return LLMUnavailableError(
        f"{message} (HTTP {status})", upstream_status=status, retry_after=retry_after
    )
