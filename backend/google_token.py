"""Verify Google ID tokens on the server. Email is never an ownership key."""

from __future__ import annotations

import time
from typing import Protocol

import httpx

from backend.identity import GoogleClaims

GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


class InvalidGoogleToken(Exception):
    pass


class GoogleTokenVerifier(Protocol):
    def verify(self, credential: str) -> GoogleClaims: ...


class GoogleTokenInfoVerifier:
    """Ask Google to validate the JWT, then enforce aud, iss, exp and sub locally."""

    def __init__(self, client_id: str, client: httpx.Client | None = None):
        self.client_id = client_id
        self._client = client or httpx.Client(timeout=httpx.Timeout(10, connect=5))

    def verify(self, credential: str) -> GoogleClaims:
        if not credential or credential.count(".") != 2:
            raise InvalidGoogleToken()
        try:
            response = self._client.get(GOOGLE_TOKENINFO, params={"id_token": credential})
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError, TypeError) as error:
            raise InvalidGoogleToken() from error
        if not isinstance(payload, dict):
            raise InvalidGoogleToken()
        issuer = payload.get("iss")
        audience = payload.get("aud")
        subject = payload.get("sub")
        try:
            expiry = int(payload.get("exp", 0))
        except (TypeError, ValueError) as error:
            raise InvalidGoogleToken() from error
        if issuer not in GOOGLE_ISSUERS or audience != self.client_id:
            raise InvalidGoogleToken()
        if not subject or not isinstance(subject, str):
            raise InvalidGoogleToken()
        if expiry <= int(time.time()):
            raise InvalidGoogleToken()
        email = payload.get("email") if payload.get("email_verified") in {True, "true"} else None
        name = payload.get("name") if isinstance(payload.get("name"), str) else None
        return GoogleClaims(
            subject=subject,
            email=email if isinstance(email, str) else None,
            name=name,
        )


class ScriptedGoogleVerifier:
    def __init__(self, tokens: dict[str, GoogleClaims]):
        self.tokens = tokens

    def verify(self, credential: str) -> GoogleClaims:
        try:
            return self.tokens[credential]
        except KeyError as error:
            raise InvalidGoogleToken() from error
