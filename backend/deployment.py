"""Deployment boundary settings and optional browser-level demo authentication."""

import base64
import binascii
import hmac
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

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


@dataclass(frozen=True)
class DeploymentSettings:
    public_demo: bool
    allowed_hosts: tuple[str, ...]
    allowed_origins: frozenset[str]
    username: str | None
    password: str | None
    web_dist: Path | None

    @classmethod
    def from_environment(cls) -> "DeploymentSettings":
        public_demo = _flag("REVISO_PUBLIC_DEMO")
        serve_web = _flag("REVISO_SERVE_WEB")
        configured_hosts = _items("REVISO_ALLOWED_HOSTS")
        configured_origins = _items("REVISO_ALLOWED_ORIGINS")
        username = os.getenv("REVISO_DEMO_USERNAME", "").strip() or None
        password = os.getenv("REVISO_DEMO_PASSWORD", "").strip() or None

        if any(not _valid_host(host) for host in configured_hosts):
            raise RuntimeError("REVISO_ALLOWED_HOSTS contains an invalid host")
        if any(
            not _valid_origin(origin, require_https=public_demo) for origin in configured_origins
        ):
            raise RuntimeError("REVISO_ALLOWED_ORIGINS contains an invalid origin")
        if (username is None) != (password is None):
            raise RuntimeError("Both demo username and password must be configured together")
        if public_demo:
            if not configured_hosts or "*" in configured_hosts:
                raise RuntimeError("Public demo mode requires explicit allowed hosts")
            if not configured_origins:
                raise RuntimeError("Public demo mode requires an explicit HTTPS origin")
            if username is None or password is None or len(password) < 16:
                raise RuntimeError("Public demo mode requires browser authentication")
            if not serve_web:
                raise RuntimeError("Public demo mode requires the built web application")

        web_dist = None
        if serve_web:
            web_dist = Path(os.getenv("REVISO_WEB_DIST", "apps/web/dist")).resolve()
            if not web_dist.is_dir():
                raise RuntimeError("Configured web build directory is unavailable")

        return cls(
            public_demo=public_demo,
            allowed_hosts=tuple(dict.fromkeys((*LOCAL_HOSTS, *configured_hosts))),
            allowed_origins=frozenset((*LOCAL_ORIGINS, *configured_origins)),
            username=username,
            password=password,
            web_dist=web_dist,
        )

    @property
    def authentication_enabled(self) -> bool:
        return self.username is not None and self.password is not None

    def requires_authentication(self, method: str, path: str) -> bool:
        """Keep saved research private while allowing the public site to render."""

        if not self.authentication_enabled:
            return False
        if method not in {"GET", "HEAD"}:
            return True
        normalized = path.rstrip("/") or "/"
        return not (
            normalized in PUBLIC_WEB_PATHS
            or normalized in PUBLIC_ASSET_PATHS
            or path.startswith("/assets/")
        )

    def authorizes(self, authorization: str | None) -> bool:
        if not self.authentication_enabled:
            return True
        if authorization is None or not authorization.startswith("Basic "):
            return False
        try:
            decoded = base64.b64decode(authorization[6:], validate=True).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError):
            return False
        supplied_username, separator, supplied_password = decoded.partition(":")
        return (
            bool(separator)
            and hmac.compare_digest(supplied_username, self.username or "")
            and hmac.compare_digest(supplied_password, self.password or "")
        )
