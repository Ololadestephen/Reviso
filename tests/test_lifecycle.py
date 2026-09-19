from fastapi.testclient import TestClient

from backend.api import create_app
from tests.conftest import named_from_assessment


def test_confirm_replay_revise_and_retire(tmp_path, thesis):
    path = str(tmp_path / "test.sqlite3")
    with TestClient(create_app(path)) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        base = f"/theses/{draft['id']}"
        assert client.post(base + "/stress", json={}).status_code == 409
        assert (
            client.post(
                base + "/confirm", json={**draft["thesis"], "expected_version": 1}
            ).status_code
            == 200
        )

        def step(index):
            return client.post(
                "/replays/nvidia-margin/step",
                json={"thesis_id": draft["id"], "expected_version": 2, "step": index},
            )

        assert step(0).json()["state"] == "SUPPORTED"
        second = step(1).json()
        assert second["state"] == "INVALIDATED"
        assert step(1).json()["input_hash"] == second["input_hash"]
        assert len(client.get(base + "/assessments").json()["assessments"]) == 2
        body = {
            **draft["thesis"],
            "expected_version": 2,
            "holding_days": 180,
            "explanation": "I am extending the research horizon with the new disclosure.",
            "evidence_ids": [second["evidence"][1]["id"]],
        }
        assert client.post(base + "/revisions", json=body).status_code == 200
        assert client.post(base + "/revisions", json=body).status_code == 409
        history = client.get(base + "/assessments").json()
        assert len(history["versions"]) == 3 and len(history["assessments"]) == 3
        assert history["versions"][1]["thesis"]["holding_days"] == 90
        assert (
            client.post(
                base + "/decisions",
                json={
                    "expected_version": 3,
                    "action": "retire",
                    "explanation": "The essential margin condition broke.",
                    **named_from_assessment(history["selected_assessment"]),
                },
            ).status_code
            == 200
        )
        assert client.post(base + "/stress", json={}).status_code == 409
    with TestClient(create_app(path)) as reopened:
        assert reopened.get(base).json()["retired"]


def test_paths_versions_and_future_revision_citations(tmp_path, thesis):
    with TestClient(create_app(str(tmp_path / "test.sqlite3"))) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        base = f"/theses/{draft['id']}"
        client.post(base + "/confirm", json={**draft["thesis"], "expected_version": 1})
        assert (
            client.post(
                "/replays/not-a-case/step",
                json={"thesis_id": draft["id"], "expected_version": 2, "step": 0},
            ).status_code
            == 404
        )
        assert client.get("/theses/missing").status_code == 404
        assert (
            client.post(
                base + "/revisions",
                json={
                    **draft["thesis"],
                    "holding_days": 100,
                    "expected_version": 2,
                    "explanation": "A change with future evidence.",
                    "evidence_ids": ["nvda-fy25-Third"],
                },
            ).status_code
            == 422
        )


def test_refresh_abstains_without_erasing_history(tmp_path, thesis, monkeypatch):
    from backend.contracts import utc_now
    from backend.disclosures import DisclosureSnapshot

    monkeypatch.setattr(
        "backend.disclosures.NvidiaDisclosureProvider.snapshot",
        lambda self: DisclosureSnapshot(
            availability="UNAVAILABLE",
            checked_at=utc_now(),
            evidence=[],
            warnings=["Unavailable test source"],
        ),
    )
    monkeypatch.setattr(
        "backend.providers.BitgetProvider.snapshot",
        lambda self, instrument_id="RNVDAUSDT": {"availability": "UNAVAILABLE"},
    )
    with TestClient(create_app(str(tmp_path / "test.sqlite3"))) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        base = f"/theses/{draft['id']}"
        client.post(base + "/confirm", json={**draft["thesis"], "expected_version": 1})
        client.post(
            "/replays/nvidia-margin/step",
            json={"thesis_id": draft["id"], "expected_version": 2, "step": 0},
        )
        refreshed = client.post(base + "/refresh", json={}).json()
        assert refreshed["state"] == "INSUFFICIENT_EVIDENCE"
        history = client.get(base + "/assessments").json()
        assert history["assessments"][0]["state"] == "SUPPORTED"
        assert history["assessments"][1]["evidence"] == []


def test_foreign_browser_origin_and_host_rejected(tmp_path, thesis):
    with TestClient(create_app(str(tmp_path / "test.sqlite3"))) as client:
        assert (
            client.post(
                "/theses/draft",
                json=thesis.model_dump(mode="json"),
                headers={"origin": "https://untrusted.example"},
            ).status_code
            == 403
        )
        assert client.get("/health", headers={"host": "untrusted.example"}).status_code == 400


def test_rewind_selects_old_assessment_and_rejects_future_citations(tmp_path, thesis):
    path = str(tmp_path / "replay.sqlite3")
    with TestClient(create_app(path)) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        base = f"/theses/{draft['id']}"
        client.post(base + "/confirm", json={**draft["thesis"], "expected_version": 1})

        def step(index):
            response = client.post(
                "/replays/nvidia-margin/step",
                json={
                    "thesis_id": draft["id"],
                    "expected_version": 2,
                    "step": index,
                },
            )
            assert response.status_code == 200
            return response.json()

        first, second = step(0), step(1)
        assert step(0)["input_hash"] == first["input_hash"]
        history = client.get(base + "/assessments").json()
        assert len(history["assessments"]) == 2
        assert history["selected_assessment"]["state"] == "SUPPORTED"
        body = {
            **draft["thesis"],
            "expected_version": 2,
            "holding_days": 180,
            "explanation": "Review the currently selected disclosure.",
            "evidence_ids": [second["evidence"][-1]["id"]],
        }
        assert client.post(base + "/revisions", json=body).status_code == 422
        assert client.get(base).json()["version"] == 2
    with TestClient(create_app(path)) as reopened:
        selected = reopened.get(base + "/assessments").json()["selected_assessment"]
        assert selected["input_hash"] == first["input_hash"]
        response = reopened.post(
            base + "/revisions",
            json={
                **body,
                "evidence_ids": [first["evidence"][0]["id"]],
            },
        )
        assert response.status_code == 200
        history = reopened.get(base + "/assessments").json()
        assert history["selected_assessment"]["state"] == "SUPPORTED"
        assert history["selected_assessment"]["evidence_cutoff"] == first["evidence_cutoff"]
        assert history["assessments"][1]["state"] == "INVALIDATED"


def test_explicit_recovery_preserves_original_invalidation(tmp_path, thesis):
    with TestClient(create_app(str(tmp_path / "recovery.sqlite3"))) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        base = f"/theses/{draft['id']}"
        client.post(base + "/confirm", json={**draft["thesis"], "expected_version": 1})
        second = client.post(
            "/replays/nvidia-margin/step",
            json={
                "thesis_id": draft["id"],
                "expected_version": 2,
                "step": 1,
            },
        ).json()
        revised = thesis.model_dump(mode="json")
        revised["assumptions"][0].update(
            {
                "claim": "GAAP margin remains at least 74%",
                "minimum": "74",
                "invalidation_condition": "Invalidate when reported GAAP gross margin is below 74%.",
            }
        )
        assert (
            client.post(
                base + "/revisions",
                json={
                    **revised,
                    "expected_version": 2,
                    "explanation": "Explicitly lower the margin floor; this changes the original thesis.",
                    "evidence_ids": [second["evidence"][-1]["id"]],
                },
            ).status_code
            == 200
        )
        history = client.get(base + "/assessments").json()
        assert history["selected_assessment"]["state"] == "SUPPORTED"
        assert history["assessments"][0]["state"] == "INVALIDATED"
        assert history["versions"][1]["thesis"]["assumptions"][0]["minimum"] == "75"
        assert "75% → 74%" in " ".join(history["events"][-1]["changes"])


def test_first_stress_is_saved_and_preserved_when_replay_starts(tmp_path, thesis):
    with TestClient(create_app(str(tmp_path / "first-stress.sqlite3"))) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        base = f"/theses/{draft['id']}"
        client.post(base + "/confirm", json={**draft["thesis"], "expected_version": 1})
        assert client.post(base + "/stress", json={"price_move_pct": "-20"}).status_code == 200
        saved = client.get(base + "/assessments").json()["selected_assessment"]
        assert saved["mode"] == "CONTROLLED_SCENARIO" and saved["evidence"] == []
        assert saved["state"] == "INSUFFICIENT_EVIDENCE"
        replay = client.post(
            "/replays/nvidia-margin/step",
            json={
                "thesis_id": draft["id"],
                "expected_version": 2,
                "step": 0,
            },
        ).json()
        assert replay["scenario"]["price_move_pct"] == "-20"


def test_confirm_rejects_a_metric_the_issuer_cannot_test(tmp_path, thesis):
    payload = thesis.model_copy(update={"instrument_id": "RGOOGLUSDT"}).model_dump(mode="json")
    with TestClient(create_app(str(tmp_path / "uncheckable.sqlite3"))) as client:
        draft = client.post("/theses/draft", json=payload).json()
        response = client.post(
            f"/theses/{draft['id']}/confirm",
            json={**draft["thesis"], "expected_version": 1},
        )
        assert response.status_code == 422
        assert "cannot numerically test" in response.json()["detail"]


def test_decision_requires_every_condition_to_be_named(tmp_path, thesis):
    with TestClient(create_app(str(tmp_path / "unnamed-decision.sqlite3"))) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        base = f"/theses/{draft['id']}"
        client.post(base + "/confirm", json={**draft["thesis"], "expected_version": 1})
        client.post(
            "/replays/nvidia-margin/step",
            json={"thesis_id": draft["id"], "expected_version": 2, "step": 1},
        )
        response = client.post(
            base + "/decisions",
            json={
                "expected_version": 2,
                "action": "retain",
                "explanation": "I still like the growth print.",
            },
        )
        assert response.status_code == 422
        assert "Name every confirmed condition" in response.json()["detail"]


def test_named_decision_records_which_conditions_still_hold(tmp_path, thesis):
    with TestClient(create_app(str(tmp_path / "named-decision.sqlite3"))) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        base = f"/theses/{draft['id']}"
        client.post(base + "/confirm", json={**draft["thesis"], "expected_version": 1})
        assessed = client.post(
            "/replays/nvidia-margin/step",
            json={"thesis_id": draft["id"], "expected_version": 2, "step": 1},
        ).json()
        response = client.post(
            base + "/decisions",
            json={
                "expected_version": 2,
                "action": "retain",
                "explanation": "Growth still clears the floor I wrote.",
                **named_from_assessment(assessed),
            },
        )
        assert response.status_code == 200
        history = client.get(base + "/assessments").json()
        explanation = history["events"][-1]["explanation"]
        assert explanation.startswith("Still hold:")
        assert "Did not hold:" in explanation
        assert "Growth still clears the floor I wrote." in explanation


def test_revision_rejects_a_metric_the_issuer_cannot_test(tmp_path, thesis):
    with TestClient(create_app(str(tmp_path / "uncheckable-revision.sqlite3"))) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        base = f"/theses/{draft['id']}"
        client.post(base + "/confirm", json={**draft["thesis"], "expected_version": 1})
        response = client.post(
            base + "/revisions",
            json={
                **draft["thesis"],
                "instrument_id": "RGOOGLUSDT",
                "expected_version": 2,
                "explanation": "Move the same GAAP floor onto Alphabet.",
            },
        )
        assert response.status_code == 422
        assert "cannot numerically test" in response.json()["detail"]
