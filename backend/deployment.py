"""Deployment boundary settings. Public demo requires Google sign-in, never Basic Auth."""

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from backend.auth import AuthSettings
from backend.identity import AuthMode
from backend.storage import LlmLimits

LOCAL_HOSTS = ("127.0.0.1", "localhost", "testserver")
LOCAL_ORIGINS = (
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
)
PUBLIC_WEB_PATHS = frozenset({"/", "/example", "/guide", "/privacy", "/terms"})
PUBLIC_ASSET_PATHS = frozenset(
    {
        "/favicon.svg",
        "/manifest.webmanifest",
        "/reviso-mark.svg",
        "/robots.txt",
        "/step-check-idea.svg",
        "/step-write-idea.svg",
        "/stock-logos/apple.svg",
        "/stock-logos/alphabet.svg",
        "/stock-logos/amazon.svg",
        "/stock-logos/microsoft.svg",
        "/stock-logos/nvidia.svg",
        "/stock-logos/tesla.svg",
    }
)
LOCAL_QWEN_LIMITS = LlmLimits(
    user_daily=1000,
    total_daily=10_000,
    max_concurrent_user=8,
    max_concurrent_total=16,
)


def _flag(name: str) -> bool:
    value = os.getenv(name, "0").strip()
    if value not in {"0", "1"}:
        raise RuntimeError(f"{name} must be 0 or 1")
    return value == "1"


def _items(name: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in os.getenv(name, "").split(",") if item.strip())


def _valid_host(host: str) -> bool:
    candidate = host.removeprefix("*.")
    return bool(candidate) and "/" not in candidate and "://" not in candidate


def _valid_origin(origin: str, *, require_https: bool) -> bool:
    parsed = urlsplit(origin)
    expected_scheme = {"https"} if require_https else {"http", "https"}
    return (
        parsed.scheme in expected_scheme
        and bool(parsed.netloc)
        and parsed.path in {"", "/"}
        and not parsed.query
        and not parsed.fragment
    )


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer") from error
    if value < 0:
        raise RuntimeError(f"{name} must be >= 0")
    return value


def _auth_mode(public_demo: bool) -> AuthMode:
    raw = os.getenv("REVISO_AUTH_MODE", "").strip().lower()
    if public_demo:
        if raw and raw != "google":
            raise RuntimeError("Public demo mode cannot use a local or simulated identity")
        return "google"
    if not raw:
        return "local"
    if raw not in {"local", "google", "simulated"}:
        raise RuntimeError("REVISO_AUTH_MODE must be local, google or simulated")
    return raw  # type: ignore[return-value]


@dataclass(frozen=True)
class DeploymentSettings:
    public_demo: bool
    allowed_hosts: tuple[str, ...]
    allowed_origins: frozenset[str]
    web_dist: Path | None
    auth: AuthSettings
    llm_limits: LlmLimits

    @classmethod
    def from_environment(cls) -> "DeploymentSettings":
        public_demo = _flag("REVISO_PUBLIC_DEMO")
        serve_web = _flag("REVISO_SERVE_WEB")
        configured_hosts = _items("REVISO_ALLOWED_HOSTS")
        configured_origins = _items("REVISO_ALLOWED_ORIGINS")
        mode = _auth_mode(public_demo)
        google_client_id = os.getenv("REVISO_GOOGLE_CLIENT_ID", "").strip() or None

        if any(not _valid_host(host) for host in configured_hosts):
            raise RuntimeError("REVISO_ALLOWED_HOSTS contains an invalid host")
        if any(
            not _valid_origin(origin, require_https=public_demo) for origin in configured_origins
        ):
            raise RuntimeError("REVISO_ALLOWED_ORIGINS contains an invalid origin")
        if public_demo:
            if not configured_hosts or "*" in configured_hosts:
                raise RuntimeError("Public demo mode requires explicit allowed hosts")
            if not configured_origins:
                raise RuntimeError("Public demo mode requires an explicit HTTPS origin")
            if not google_client_id:
                raise RuntimeError("Public demo mode requires Google sign-in")
            if not serve_web:
                raise RuntimeError("Public demo mode requires the built web application")
        elif mode == "google" and not google_client_id:
            raise RuntimeError("Google sign-in requires REVISO_GOOGLE_CLIENT_ID")

        if mode != "google":
            google_client_id = None

        web_dist = None
        if serve_web:
            web_dist = Path(os.getenv("REVISO_WEB_DIST", "apps/web/dist")).resolve()
            if not web_dist.is_dir():
                raise RuntimeError("Configured web build directory is unavailable")

        if public_demo:
            limits = LlmLimits(
                user_daily=_int_env("REVISO_QWEN_USER_DAILY_LIMIT", 20),
                total_daily=_int_env("REVISO_QWEN_TOTAL_DAILY_LIMIT", 200),
                max_concurrent_user=_int_env("REVISO_QWEN_MAX_CONCURRENT_USER", 1),
                max_concurrent_total=_int_env("REVISO_QWEN_MAX_CONCURRENT_TOTAL", 4),
            )
            if (
                limits.user_daily <= 0
                or limits.total_daily <= 0
                or limits.max_concurrent_user <= 0
                or limits.max_concurrent_total <= 0
            ):
                raise RuntimeError("Public demo mode requires Qwen usage limits")
        else:
            limits = LlmLimits(
                user_daily=_int_env("REVISO_QWEN_USER_DAILY_LIMIT", LOCAL_QWEN_LIMITS.user_daily),
                total_daily=_int_env(
                    "REVISO_QWEN_TOTAL_DAILY_LIMIT", LOCAL_QWEN_LIMITS.total_daily
                ),
                max_concurrent_user=_int_env(
                    "REVISO_QWEN_MAX_CONCURRENT_USER", LOCAL_QWEN_LIMITS.max_concurrent_user
                ),
                max_concurrent_total=_int_env(
                    "REVISO_QWEN_MAX_CONCURRENT_TOTAL", LOCAL_QWEN_LIMITS.max_concurrent_total
                ),
            )

        if public_demo:
            allowed_hosts = tuple(dict.fromkeys(configured_hosts))
            allowed_origins = frozenset(configured_origins)
        else:
            allowed_hosts = tuple(dict.fromkeys((*LOCAL_HOSTS, *configured_hosts)))
            allowed_origins = frozenset((*LOCAL_ORIGINS, *configured_origins))

        return cls(
            public_demo=public_demo,
            allowed_hosts=allowed_hosts,
            allowed_origins=allowed_origins,
            web_dist=web_dist,
            auth=AuthSettings(
                mode=mode,
                google_client_id=google_client_id,
                cookie_secure=public_demo,
            ),
            llm_limits=limits,
        )
