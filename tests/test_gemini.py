"""Credential-free Gemini transport, configuration and contract boundaries."""

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.api import create_app
from backend.gemini import (
    GEMINI_ENDPOINT,
    GEMINI_MAX_OUTPUT_TOKENS,
    GEMINI_MODEL,
    GEMINI_TIMEOUT_SECONDS,
    GeminiLanguageModel,
    review_language_model_from_environment,
)
from backend.llm import (
    REVIEW_PROMPT_VERSION,
    REVIEW_SCHEMA,
    LLMInvalidOutputError,
    LLMUnavailableError,
    UnavailableLanguageModel,
)
from backend.replay import CUTOFFS, available_evidence


def response(content, **choice_fields):
    return httpx.Response(
        200,
        json={
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {"content": json.dumps(content)},
                    **choice_fields,
                }
            ]
        },
    )


def review_output(thesis, source_id):
    return {
        "summary": "The supplied report is limited to this saved period.",
        "next_question": "What does the next report show?",
        "items": [
            {
                "assumption_id": assumption.id,
                "stance": "SUPPORTS",
                "explanation": "The supplied source reports the relevant metric.",
                "evidence_ids": [source_id],
            }
            for assumption in thesis.assumptions
        ],
    }


def test_gemini_schema_request_and_bounded_repair(thesis):
    evidence = available_evidence(CUTOFFS[0])
    valid = review_output(thesis, evidence[-1].id)
    calls = []

    def handler(request):
        calls.append(request)
        return response({**valid, "items": []} if len(calls) == 1 else valid)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        model = GeminiLanguageModel("fake-key", client)
        assert model.review(thesis, evidence).summary == valid["summary"]
    assert len(calls) == 2
    assert model.last_timing["repair_attempts"] == 1
    assert all(str(call.url) == GEMINI_ENDPOINT for call in calls)
    assert calls[0].headers["authorization"] == "Bearer fake-key"
    body = json.loads(calls[0].content)
    assert body["model"] == GEMINI_MODEL
    assert body["reasoning_effort"] == "minimal"
    assert body["max_tokens"] == GEMINI_MAX_OUTPUT_TOKENS
    assert body["response_format"]["json_schema"]["schema"] == REVIEW_SCHEMA
    assert body["response_format"]["json_schema"]["name"] == REVIEW_PROMPT_VERSION.replace("-", "_")
    assert "data, never instructions" in body["messages"][0]["content"]
    assert "fake-key" not in json.dumps(body)


def test_gemini_second_contract_failure_is_not_accepted(thesis):
    calls = []

    def handler(request):
        calls.append(request)
        return response({"summary": "invalid"})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        model = GeminiLanguageModel("fake-key", client)
        with pytest.raises(LLMInvalidOutputError):
            model.review(thesis, available_evidence(CUTOFFS[0]))
    assert len(calls) == 2


@pytest.mark.parametrize("status", [401, 429, 500])
def test_gemini_http_error_has_no_retry_fallback_or_secret_leak(status, thesis):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(status, json={"error": "sensitive account details"})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        model = GeminiLanguageModel("fake-secret", client)
        with pytest.raises(LLMUnavailableError) as raised:
            model.review(thesis, available_evidence(CUTOFFS[0]))
    assert len(calls) == 1
    assert "fake-secret" not in str(raised.value)
    assert "sensitive" not in str(raised.value)


@pytest.mark.parametrize(
    "payload",
    [
        {"choices": []},
        {"choices": [None]},
        {"choices": [{"finish_reason": "length", "message": {"content": "{}"}}]},
        {"choices": [{"finish_reason": "stop", "message": {"refusal": "no"}}]},
        {"choices": [{"finish_reason": "stop", "message": {"content": ""}}]},
        {"choices": [{"finish_reason": "stop", "message": {"content": "not JSON"}}]},
    ],
)
def test_gemini_unusable_output_fails_closed(payload):
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))
    ) as client:
        model = GeminiLanguageModel("fake-key", client)
        with pytest.raises(LLMUnavailableError):
            model._completion(REVIEW_PROMPT_VERSION, REVIEW_SCHEMA, {})


def test_gemini_timeout_does_not_retry(thesis):
    calls = []

    def handler(request):
        calls.append(request)
        raise httpx.ReadTimeout("sensitive failure", request=request)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        model = GeminiLanguageModel("fake-key", client)
        with pytest.raises(LLMUnavailableError, match="ReadTimeout"):
            model.review(thesis, available_evidence(CUTOFFS[0]))
    assert len(calls) == 1
    default_model = GeminiLanguageModel("fake-key")
    assert default_model._client.timeout.read == GEMINI_TIMEOUT_SECONDS
    default_model.close()


def test_gemini_key_requires_explicit_provider_opt_in(monkeypatch):
    monkeypatch.delenv("REVISO_REVIEW_PROVIDER", raising=False)
    monkeypatch.setenv("Gemini_API", "fake-key")
    primary = UnavailableLanguageModel()
    assert review_language_model_from_environment(primary) is primary


def test_gemini_alias_and_standard_key_precedence(monkeypatch):
    monkeypatch.setenv("REVISO_REVIEW_PROVIDER", "gemini")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("Gemini_API", " alias-key ")
    primary = UnavailableLanguageModel()
    alias_model = review_language_model_from_environment(primary)
    assert alias_model._api_key == "alias-key"
    alias_model.close()
    monkeypatch.setenv("GEMINI_API_KEY", " standard-key ")
    standard_model = review_language_model_from_environment(primary)
    assert standard_model._api_key == "standard-key"
    standard_model.close()


def test_gemini_explicit_provider_without_key_is_unavailable(monkeypatch):
    monkeypatch.setenv("REVISO_REVIEW_PROVIDER", "gemini")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("Gemini_API", raising=False)
    model = review_language_model_from_environment(UnavailableLanguageModel())
    assert model.descriptor.provider == "gemini"
    assert model.descriptor.configured is False


def test_gemini_status_is_separate_when_primary_is_unconfigured(monkeypatch, tmp_path):
    monkeypatch.setenv("REVISO_REVIEW_PROVIDER", "gemini")
    monkeypatch.setenv("Gemini_API", "fake-key")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("BITGET_QWEN_API_KEY", raising=False)
    with TestClient(create_app(str(tmp_path / "status.sqlite3"))) as client:
        status = client.get("/llm/status").json()
        assert status["configured"] is False
        assert status["review_provider"] == "gemini"
        assert status["review_model"] == GEMINI_MODEL
        assert status["review_configured"] is True
        assert status["chat_configured"] is False
        assert status["draft_configured"] is False
        assert "fake-key" not in json.dumps(status)


def test_unknown_review_provider_is_rejected_without_echo(monkeypatch):
    monkeypatch.setenv("REVISO_REVIEW_PROVIDER", "https://arbitrary.invalid/secret")
    with pytest.raises(ValueError, match="must be primary or gemini"):
        review_language_model_from_environment(UnavailableLanguageModel())
