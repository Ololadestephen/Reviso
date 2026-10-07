"""Provider errors preserve actionable status without leaking untrusted bodies."""

import asyncio

import httpx
import pytest

from backend.api import llm_unavailable
from backend.llm import GroqLanguageModel, LLMUnavailableError
from backend.provider_errors import provider_http_failure, retry_seconds


@pytest.mark.parametrize(
    ("status", "code", "message"),
    [
        (400, "json_validate_failed", "could not format"),
        (400, "unknown", "request settings"),
        (401, "invalid_api_key", "key or access"),
        (403, "model_permission_blocked", "key or access"),
        (404, "model_not_found", "model setting"),
        (400, "model_decommissioned", "model setting"),
        (413, None, "too large"),
        (422, None, "request settings"),
        (429, "rate_limit_exceeded", "request limit"),
        (498, None, "temporarily unavailable"),
        (500, None, "temporarily unavailable"),
        (502, None, "temporarily unavailable"),
        (503, None, "temporarily unavailable"),
    ],
)
def test_http_failures_are_safe_actionable_and_not_retried(thesis, caplog, status, code, message):
    calls = 0

    def handler(_request):
        nonlocal calls
        calls += 1
        return httpx.Response(
            status,
            json={
                "error": {
                    "code": code,
                    "message": "private-account-and-secret",
                    "failed_generation": "private research",
                }
            },
            headers={"retry-after": "1.2"},
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        model = GroqLanguageModel("private-api-key", client=client)
        with pytest.raises(LLMUnavailableError, match=message) as caught:
            model.extract(thesis)
    error = caught.value
    assert calls == 1
    assert error.upstream_status == status
    assert error.retry_after == (2 if status == 429 else None)
    assert f"HTTP {status}" in str(error)
    assert f"status={status}" in caplog.text
    for private in ("private-account", "private research", "private-api-key"):
        assert private not in str(error)
        assert private not in caplog.text
    assert "code=unknown" not in caplog.text


@pytest.mark.parametrize(
    "body", [[], None, "secret", {"error": "secret"}, {"error": {"code": ["secret"]}}]
)
def test_nonstandard_error_body_does_not_hide_http_status(body):
    error = provider_http_failure(httpx.Response(429, json=body), provider="groq", model="test")
    assert error.upstream_status == 429
    assert error.retry_after is None
    assert "secret" not in str(error)


def test_non_json_error_body_is_not_exposed():
    error = provider_http_failure(
        httpx.Response(503, text="private upstream page"), provider="groq", model="test"
    )
    assert "HTTP 503" in str(error)
    assert "private" not in str(error)


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        (None, None),
        ("0", 1),
        ("1.001", 2),
        ("30", 30),
        ("86400", 86400),
        ("86400.1", None),
        ("999999", None),
        ("-1", None),
        ("nan", None),
        ("inf", None),
        ("1\r\nsecret", None),
        ("untrusted", None),
    ],
)
def test_retry_time_is_bounded(header, expected):
    assert retry_seconds(header) == expected


def test_api_retains_unavailable_contract_and_safe_retry_header():
    error = provider_http_failure(
        httpx.Response(429, headers={"retry-after": "4.1"}), provider="groq", model="test"
    )
    response = asyncio.run(llm_unavailable(None, error))
    assert response.status_code == 503
    assert response.headers["retry-after"] == "5"
    assert b"HTTP 429" in response.body


def test_existing_unavailable_errors_remain_compatible():
    response = asyncio.run(llm_unavailable(None, LLMUnavailableError("Not configured")))
    assert response.status_code == 503
    assert "retry-after" not in response.headers
    assert response.body == b'{"detail":"Not configured"}'
