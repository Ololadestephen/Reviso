import base64

import pytest
from fastapi.testclient import TestClient

from backend.api import create_app
from backend.llm import UnavailableLanguageModel


def basic(username: str, password: str) -> dict[str, str]:
    encoded = base64.b64encode(f"{username}:{password}".encode()).decode()
    return {"Authorization": f"Basic {encoded}"}


def test_public_demo_requires_complete_secure_configuration(monkeypatch):
    monkeypatch.setenv("REVISO_PUBLIC_DEMO", "1")
    with pytest.raises(RuntimeError, match="explicit allowed hosts"):
        create_app(llm=UnavailableLanguageModel())

    monkeypatch.setenv("REVISO_ALLOWED_HOSTS", "demo.example")
    monkeypatch.setenv("REVISO_ALLOWED_ORIGINS", "http://demo.example")
    with pytest.raises(RuntimeError, match="invalid origin"):
        create_app(llm=UnavailableLanguageModel())


def test_public_pages_are_open_while_saved_research_requires_authentication(tmp_path, monkeypatch):
    web = tmp_path / "web"
    web.mkdir()
    (web / "index.html").write_text("<h1>Reviso deployment fixture</h1>")
    assets = web / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log('fixture')")
    public_images = (
        "/reviso-mark.svg",
        "/step-check-idea.svg",
        "/step-write-idea.svg",
        "/stock-logos/alphabet.svg",
        "/stock-logos/amazon.svg",
        "/stock-logos/apple.svg",
        "/stock-logos/microsoft.svg",
        "/stock-logos/nvidia.svg",
        "/stock-logos/tesla.svg",
    )
    for path in public_images:
        image = web / path.removeprefix("/")
        image.parent.mkdir(parents=True, exist_ok=True)
        image.write_text("<svg/>")
    monkeypatch.setenv("REVISO_PUBLIC_DEMO", "1")
    monkeypatch.setenv("REVISO_SERVE_WEB", "1")
    monkeypatch.setenv("REVISO_WEB_DIST", str(web))
    monkeypatch.setenv("REVISO_ALLOWED_HOSTS", "demo.example")
    monkeypatch.setenv("REVISO_ALLOWED_ORIGINS", "https://demo.example")
    monkeypatch.setenv("REVISO_DEMO_USERNAME", "judge")
    monkeypatch.setenv("REVISO_DEMO_PASSWORD", "a-long-demo-password")

    app = create_app(str(tmp_path / "deployment.sqlite3"), UnavailableLanguageModel())
    with TestClient(app, base_url="https://demo.example") as client:
        landing = client.get("/")
        example = client.get("/example")
        asset = client.get("/assets/app.js")
        image_responses = [client.get(path) for path in public_images]
        protected_app = client.get("/app")
        legacy_saved_link = client.get("/thesis/saved-id")
        assert client.get("/api/health", headers=basic("judge", "wrong")).status_code == 401
        page = client.get("/app", headers=basic("judge", "a-long-demo-password"))
        health = client.get(
            "/api/health",
            headers={
                **basic("judge", "a-long-demo-password"),
                "Origin": "https://demo.example",
            },
        )
        rejected = client.get(
            "/api/health",
            headers={
                **basic("judge", "a-long-demo-password"),
                "Origin": "https://attacker.example",
            },
        )

    assert landing.status_code == 200
    assert example.status_code == 200
    assert asset.status_code == 200
    assert all(response.status_code == 200 for response in image_responses)
    assert protected_app.status_code == 401
    assert legacy_saved_link.status_code == 401
    assert page.status_code == 200
    assert "Reviso deployment fixture" in page.text
    assert health.status_code == 200
    assert health.json()["mode"] == "private_demo"
    assert rejected.status_code == 403


def test_client_routes_survive_a_reload_without_shadowing_the_api(tmp_path, monkeypatch):
    web = tmp_path / "web"
    web.mkdir()
    (web / "index.html").write_text("<h1>Reviso deployment fixture</h1>")
    (web / "favicon.svg").write_text("<svg/>")
    monkeypatch.setenv("REVISO_SERVE_WEB", "1")
    monkeypatch.setenv("REVISO_WEB_DIST", str(web))

    app = create_app(str(tmp_path / "spa.sqlite3"), UnavailableLanguageModel())
    with TestClient(app) as client:
        deep_link = client.get("/thesis/2f0a9c1e-0000-4000-8000-000000000000")
        real_file = client.get("/favicon.svg")
        api = client.get("/api/health")
        missing_record = client.get("/api/theses/does-not-exist")

    # An unknown client path is the router's to resolve, not a 404.
    assert deep_link.status_code == 200
    assert "Reviso deployment fixture" in deep_link.text
    assert real_file.status_code == 200 and "<svg/>" in real_file.text
    # The fallback must never swallow an API answer and return HTML instead.
    assert api.status_code == 200 and api.json()["status"] == "ok"
    assert api.json()["mode"] == "local_single_user"
    assert missing_record.status_code == 404
    assert missing_record.json()["detail"] == "Record not found"


def test_partial_demo_credentials_are_rejected(monkeypatch):
    monkeypatch.setenv("REVISO_DEMO_USERNAME", "judge")
    with pytest.raises(RuntimeError, match="configured together"):
        create_app(llm=UnavailableLanguageModel())
