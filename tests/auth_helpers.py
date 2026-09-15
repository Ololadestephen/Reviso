from fastapi.testclient import TestClient

from backend.api import create_app
from backend.google_token import ScriptedGoogleVerifier
from backend.identity import GoogleClaims
from backend.llm import UnavailableLanguageModel
from tests.test_llm import FakeLanguageModel


def csrf_headers(client: TestClient) -> dict[str, str]:
    token = client.cookies.get("reviso_csrf")
    return {"X-CSRF-Token": token} if token else {}


def simulated_client(tmp_path, monkeypatch, llm=None, name="auth.sqlite3"):
    monkeypatch.setenv("REVISO_AUTH_MODE", "simulated")
    app = create_app(str(tmp_path / name), llm=llm or UnavailableLanguageModel())
    return app


def sign_in(client: TestClient, subject: str, email: str | None = None) -> dict:
    response = client.post(
        "/auth/simulate", json={"subject": subject, "email": email or f"{subject}@example.test"}
    )
    assert response.status_code == 200, response.text
    return response.json()


def google_app(tmp_path, monkeypatch, tokens: dict[str, GoogleClaims], llm=None):
    monkeypatch.setenv("REVISO_AUTH_MODE", "google")
    monkeypatch.setenv("REVISO_GOOGLE_CLIENT_ID", "test-google-client.apps.googleusercontent.com")
    return create_app(
        str(tmp_path / "google.sqlite3"),
        llm=llm or FakeLanguageModel(),
        google_verifier=ScriptedGoogleVerifier(tokens),
    )
