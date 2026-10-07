"""Opt-in Gemini explanation adapter using Google's compatible JSON endpoint."""

import json
import os

import httpx

from backend.llm import (
    SYSTEM_PROMPT,
    LanguageModel,
    LLMDescriptor,
    LLMUnavailableError,
    SchemaLanguageModel,
    UnavailableLanguageModel,
)

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
GEMINI_MODEL = "gemini-3.5-flash-lite"
GEMINI_TIMEOUT_SECONDS = 10
GEMINI_MAX_OUTPUT_TOKENS = 2000


class GeminiLanguageModel(SchemaLanguageModel):
    def __init__(self, api_key: str, client: httpx.Client | None = None):
        super().__init__(
            api_key,
            LLMDescriptor("gemini", GEMINI_MODEL, True),
            client or httpx.Client(timeout=httpx.Timeout(GEMINI_TIMEOUT_SECONDS, connect=3)),
        )

    def _completion(self, prompt_version: str, schema: dict, user_payload: dict) -> object:
        payload = self._post(
            GEMINI_ENDPOINT,
            {
                "model": self.descriptor.model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(user_payload, separators=(",", ":"))},
                ],
                "reasoning_effort": "minimal",
                "max_tokens": GEMINI_MAX_OUTPUT_TOKENS,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": prompt_version.replace("-", "_"),
                        "strict": False,
                        "schema": schema,
                    },
                },
            },
        )
        try:
            choice = payload["choices"][0]
            message = choice["message"]
            if choice.get("finish_reason") != "stop" or message.get("refusal"):
                raise LLMUnavailableError("gemini response unavailable (incomplete or refused)")
            content = message["content"]
        except (KeyError, IndexError, TypeError, AttributeError) as error:
            raise LLMUnavailableError(
                f"gemini response unavailable ({type(error).__name__})"
            ) from error
        if not content:
            raise LLMUnavailableError("gemini response unavailable (empty content)")
        return self._decode_json(content)


def review_language_model_from_environment(primary: LanguageModel) -> LanguageModel:
    """Adding a key alone must not silently send research to a new provider."""
    provider = os.getenv("REVISO_REVIEW_PROVIDER", "primary").strip().lower() or "primary"
    if provider == "primary":
        return primary
    if provider != "gemini":
        raise ValueError("REVISO_REVIEW_PROVIDER must be primary or gemini")
    api_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("Gemini_API", "").strip()
    if api_key:
        return GeminiLanguageModel(api_key)
    return UnavailableLanguageModel(provider="gemini", model=GEMINI_MODEL)
