import pytest
from fastapi.testclient import TestClient

from backend.api import create_app
from backend.google_token import InvalidGoogleToken, ScriptedGoogleVerifier
from backend.identity import GoogleClaims
from backend.llm import UnavailableLanguageModel
from tests.auth_helpers import csrf_headers, google_app, sign_in, simulated_client


def test_matching_emails_do_not_merge_google_accounts(tmp_path, monkeypatch):
    tokens = {
        "credential-one-" + "x" * 20: GoogleClaims(
            subject="google-sub-1", email="shared@example.com", name="One"
        ),
        "credential-two-" + "x" * 20: GoogleClaims(
            subject="google-sub-2", email="shared@example.com", name="Two"
        ),
    }
    app = google_app(tmp_path, monkeypatch, tokens)
    with TestClient(app) as first, TestClient(app) as second:
        one = first.post("/auth/google", json={"credential": "credential-one-" + "x" * 20})
        two = second.post("/auth/google", json={"credential": "credential-two-" + "x" * 20})
        assert one.status_code == 200 and two.status_code == 200
        assert one.json()["user_id"] != two.json()["user_id"]
        assert one.json()["email"] == two.json()["email"] == "shared@example.com"


def test_google_rejects_invalid_and_unknown_tokens(tmp_path, monkeypatch):
    app = google_app(
        tmp_path,
        monkeypatch,
        {"credential-good-" + "x" * 20: GoogleClaims(subject="sub-1", email="a@b.test")},
    )
    with TestClient(app) as client:
        rejected = client.post("/auth/google", json={"credential": "credential-bad-" + "x" * 20})
        assert rejected.status_code == 401
        assert client.get("/auth/me").status_code == 401
        accepted = client.post("/auth/google", json={"credential": "credential-good-" + "x" * 20})
        assert accepted.status_code == 200
        assert client.get("/auth/me").json()["user_id"] == accepted.json()["user_id"]
        client.post("/auth/logout", headers=csrf_headers(client))
        assert client.get("/auth/me").status_code == 401


def test_google_mutations_require_csrf(tmp_path, monkeypatch, thesis):
    credential = "credential-good-" + "x" * 20
    app = google_app(
        tmp_path,
        monkeypatch,
        {credential: GoogleClaims(subject="sub-1", email="a@b.test")},
    )
    with TestClient(app) as client:
        assert client.post("/auth/google", json={"credential": credential}).status_code == 200
        missing = client.post("/theses/draft", json=thesis.model_dump(mode="json"))
        assert missing.status_code == 403
        created = client.post(
            "/theses/draft",
            json=thesis.model_dump(mode="json"),
            headers=csrf_headers(client),
        )
        assert created.status_code == 201


def test_public_demo_google_session_cookie_is_secure(tmp_path, monkeypatch, thesis):
    web = tmp_path / "web"
    web.mkdir()
    (web / "index.html").write_text("<h1>fixture</h1>")
    monkeypatch.setenv("REVISO_PUBLIC_DEMO", "1")
    monkeypatch.setenv("REVISO_SERVE_WEB", "1")
    monkeypatch.setenv("REVISO_WEB_DIST", str(web))
    monkeypatch.setenv("REVISO_ALLOWED_HOSTS", "demo.example")
    monkeypatch.setenv("REVISO_ALLOWED_ORIGINS", "https://demo.example")
    monkeypatch.setenv("REVISO_GOOGLE_CLIENT_ID", "test-google-client.apps.googleusercontent.com")
    credential = "credential-good-" + "x" * 20
    app = create_app(
        str(tmp_path / "secure.sqlite3"),
        llm=UnavailableLanguageModel(),
        google_verifier=ScriptedGoogleVerifier(
            {credential: GoogleClaims(subject="sub-1", email="a@b.test")}
        ),
    )
    with TestClient(app, base_url="https://demo.example") as client:
        login = client.post("/auth/google", json={"credential": credential})
        assert login.status_code == 200
        cookies = login.headers.get("set-cookie") or ""
        assert "reviso_session=" in cookies
        assert "Secure" in cookies
        assert "HttpOnly" in cookies
        missing = client.post("/api/theses/draft", json=thesis.model_dump(mode="json"))
        assert missing.status_code == 403
        created = client.post(
            "/api/theses/draft",
            json=thesis.model_dump(mode="json"),
            headers=csrf_headers(client),
        )
        assert created.status_code == 201


def test_simulated_csrf_is_required_after_cookie_login(tmp_path, monkeypatch, thesis):
    app = simulated_client(tmp_path, monkeypatch)
    with TestClient(app) as client:
        sign_in(client, "alice")
        missing = client.post("/theses/draft", json=thesis.model_dump(mode="json"))
        assert missing.status_code == 403
        created = client.post(
            "/theses/draft",
            json=thesis.model_dump(mode="json"),
            headers=csrf_headers(client),
        )
        assert created.status_code == 201


def test_local_mode_never_falls_back_when_google_is_required(tmp_path, monkeypatch):
    monkeypatch.setenv("REVISO_PUBLIC_DEMO", "1")
    monkeypatch.setenv("REVISO_AUTH_MODE", "local")
    monkeypatch.setenv("REVISO_ALLOWED_HOSTS", "demo.example")
    monkeypatch.setenv("REVISO_ALLOWED_ORIGINS", "https://demo.example")
    monkeypatch.setenv("REVISO_SERVE_WEB", "1")
    monkeypatch.setenv("REVISO_WEB_DIST", str(tmp_path))
    (tmp_path / "index.html").write_text("<h1>fixture</h1>")
    with pytest.raises(RuntimeError, match="cannot use a local"):
        create_app(str(tmp_path / "denied.sqlite3"), llm=UnavailableLanguageModel())


def test_scripted_verifier_rejects_unknown_credentials():
    verifier = ScriptedGoogleVerifier({})
    with pytest.raises(InvalidGoogleToken):
        verifier.verify("missing")
