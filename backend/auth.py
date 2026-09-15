"""Session cookies, CSRF, and login wiring. Ownership is always an internal user id."""

from __future__ import annotations

import hmac
from dataclasses import dataclass

from fastapi import HTTPException, Request, Response
from pydantic import Field

from backend.contracts import Contract
from backend.identity import (
    ISSUER_GOOGLE,
    ISSUER_SIMULATED,
    AuthMode,
    GoogleClaims,
    Principal,
)
from backend.storage import Repository

SESSION_COOKIE = "reviso_session"
CSRF_COOKIE = "reviso_csrf"
CSRF_HEADER = "X-CSRF-Token"


class GoogleLoginInput(Contract):
    credential: str = Field(min_length=20, max_length=8192)


class SimulateLoginInput(Contract):
    subject: str = Field(min_length=1, max_length=128)
    email: str | None = Field(default=None, max_length=320)


@dataclass(frozen=True)
class AuthSettings:
    mode: AuthMode
    google_client_id: str | None
    cookie_secure: bool

    def public(self) -> dict[str, str | None]:
        return {
            "mode": self.mode,
            "google_client_id": self.google_client_id if self.mode == "google" else None,
        }


def set_session_cookies(
    response: Response, raw_token: str, csrf: str, *, secure: bool, max_age: int = 14 * 24 * 3600
) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        raw_token,
        httponly=True,
        samesite="lax",
        secure=secure,
        path="/",
        max_age=max_age,
    )
    response.set_cookie(
        CSRF_COOKIE,
        csrf,
        httponly=False,
        samesite="lax",
        secure=secure,
        path="/",
        max_age=max_age,
    )


def clear_session_cookies(response: Response, *, secure: bool) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/", secure=secure, httponly=True, samesite="lax")
    response.delete_cookie(CSRF_COOKIE, path="/", secure=secure, samesite="lax")


def session_token(request: Request) -> str | None:
    return request.cookies.get(SESSION_COOKIE)


def resolve_principal(
    request: Request, repo: Repository, settings: AuthSettings
) -> Principal | None:
    raw = session_token(request)
    if raw:
        return repo.session_principal(raw, settings.mode)
    if settings.mode == "local":
        return repo.local_principal()
    return None


def csrf_is_required(request: Request, principal: Principal | None) -> bool:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return False
    path = _normalized(request.url.path)
    if path in {"/auth/google", "/auth/simulate"}:
        return False
    return principal is not None and principal.csrf_secret is not None


def valid_csrf(request: Request, secret: str) -> bool:
    supplied = request.headers.get(CSRF_HEADER)
    return bool(supplied) and hmac.compare_digest(supplied, secret)


def _normalized(path: str) -> str:
    if path.startswith("/api/"):
        return path[4:]
    if path == "/api":
        return "/"
    return path


def google_principal(repo: Repository, claims: GoogleClaims) -> tuple[Principal, str, str]:
    user = repo.user_for_identity(
        ISSUER_GOOGLE,
        claims.subject,
        email=claims.email,
        display_name=claims.name or (claims.email.split("@")[0] if claims.email else None),
    )
    raw, csrf, _expires = repo.create_session(user["id"])
    principal = Principal(
        user_id=user["id"],
        kind=user["kind"],
        auth="google",
        email=user["email"],
        display_name=user["display_name"],
        csrf_secret=csrf,
    )
    return principal, raw, csrf


def simulated_principal(
    repo: Repository, subject: str, email: str | None
) -> tuple[Principal, str, str]:
    user = repo.user_for_identity(
        ISSUER_SIMULATED,
        subject,
        email=email,
        display_name=subject,
    )
    raw, csrf, _expires = repo.create_session(user["id"])
    principal = Principal(
        user_id=user["id"],
        kind=user["kind"],
        auth="simulated",
        email=user["email"],
        display_name=user["display_name"],
        csrf_secret=csrf,
    )
    return principal, raw, csrf


def require_principal(request: Request) -> Principal:
    principal = getattr(request.state, "principal", None)
    if principal is None:
        raise HTTPException(status_code=401, detail="Sign in to open your research")
    return principal
