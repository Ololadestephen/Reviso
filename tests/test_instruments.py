from datetime import UTC, datetime

from fastapi.testclient import TestClient

from backend.api import create_app
from backend.contracts import Evidence, StressInput
from backend.services import assessment


def test_catalog_exposes_only_the_verified_small_selection(tmp_path):
    with TestClient(create_app(str(tmp_path / "catalog.sqlite3"))) as client:
        instruments = client.get("/instruments").json()
        assert [item["id"] for item in instruments] == [
            "RNVDAUSDT",
            "RAAPLUSDT",
            "RMSFTUSDT",
            "RGOOGLUSDT",
            "RAMZNUSDT",
            "RTSLAUSDT",
        ]
        assert [item["display_name"] for item in instruments] == [
            "NVIDIA",
            "Apple",
            "Microsoft",
            "Alphabet",
            "Amazon",
            "Tesla",
        ]
        assert all(
            item["terms_source"].startswith("https://www.bitget.com/") for item in instruments
        )
        assert client.get("/instruments/UNKNOWN").status_code == 422


def test_foreign_company_evidence_is_not_saved_or_evaluated(thesis):
    apple_thesis = thesis.model_copy(update={"instrument_id": "RAAPLUSDT"})
    evidence = Evidence(
        id="nvidia-only",
        instrument_id="RNVDAUSDT",
        source_url="https://nvidianews.nvidia.com/news/example",
        publisher="NVIDIA",
        title="NVIDIA results",
        excerpt="Reported margin was 99%.",
        published_at=datetime(2026, 9, 1, tzinfo=UTC),
        available_at=datetime(2026, 9, 2, tzinfo=UTC),
        observed_at=datetime(2026, 8, 31, tzinfo=UTC),
        retrieved_at=datetime(2026, 9, 3, tzinfo=UTC),
        content_hash="content",
        duplicate_family="nvidia",
        scope="NVIDIA only",
        limitations="Not Apple evidence.",
        metrics={"gaap_margin_pct": "99", "revenue_growth_yoy_pct": "99"},
        origin="PUBLIC_RETRIEVAL",
    )
    result = assessment(
        {
            "id": "apple-thesis",
            "version": 2,
            "thesis": apple_thesis.model_dump(mode="json"),
        },
        [evidence],
        datetime(2026, 9, 3, tzinfo=UTC),
        StressInput(),
        "LIVE_REFRESH",
    )
    assert result["state"] == "INSUFFICIENT_EVIDENCE"
    assert result["evidence"] == []


def test_nvidia_only_historical_replay_is_rejected_for_apple(tmp_path, thesis):
    apple = thesis.model_copy(update={"instrument_id": "RAAPLUSDT"})
    with TestClient(create_app(str(tmp_path / "apple.sqlite3"))) as client:
        draft = client.post("/theses/draft", json=apple.model_dump(mode="json")).json()
        client.post(
            f"/theses/{draft['id']}/confirm",
            json={**draft["thesis"], "expected_version": 1},
        )
        response = client.post(
            "/replays/nvidia-margin/step",
            json={"thesis_id": draft["id"], "expected_version": 2, "step": 0},
        )
        assert response.status_code == 409
        assert "NVIDIA only" in response.json()["detail"]
