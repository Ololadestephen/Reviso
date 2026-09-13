import json

import pytest

from scripts.newcomer_live_validation import (
    ABSOLUTE_REQUEST_CAP,
    digest_json,
    freeze,
    suggestion_checks,
    verify_frozen,
)


class StubAttemptModel:
    def __init__(self):
        self.attempts = [
            {
                "request": {
                    "input": json.dumps(
                        {
                            "instrument_id": "RMSFTUSDT",
                            "idea_as_untrusted_data": "Cloud demand and competition matter.",
                        }
                    )
                }
            }
        ]


def test_digest_is_canonical():
    assert digest_json({"b": 2, "a": 1}) == digest_json({"a": 1, "b": 2})


def test_freeze_rejects_unexpected_or_started_corpus(tmp_path):
    directory = tmp_path / "batch"
    directory.mkdir()
    (directory / "corpus.json").write_text(
        json.dumps({"request_cap": ABSOLUTE_REQUEST_CAP, "cases": []})
    )
    with pytest.raises(RuntimeError, match="shape"):
        freeze(directory)

    (directory / "STARTED").write_text("already-started")
    with pytest.raises(RuntimeError, match="started"):
        freeze(directory)


def test_verify_frozen_rejects_modified_corpus(tmp_path, monkeypatch):
    directory = tmp_path / "batch"
    directory.mkdir()
    corpus = {"request_cap": 10, "cases": [{"id": str(index)} for index in range(5)]}
    (directory / "corpus.json").write_text(json.dumps(corpus))
    (directory / "manifest.json").write_text(
        json.dumps(
            {
                "corpus_sha256": "0" * 64,
                "case_count": 5,
                "request_cap": 10,
                "source_sha256": {},
            }
        )
    )
    with pytest.raises(RuntimeError, match="corpus changed"):
        verify_frozen(directory)


def test_microsoft_suggestion_checks_require_manual_competition_claim(tmp_path, monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "rationale": "Microsoft cloud demand may remain durable while competition stays manageable.",
                "assumptions": [
                    {
                        "id": "cloud-growth",
                        "claim": "Reported revenue growth remains at least 10% year-over-year.",
                        "metric": "revenue_growth_yoy_pct",
                        "minimum": "10",
                        "invalidation_condition": "Invalidate when reported year-over-year revenue growth is below 10%.",
                    },
                    {
                        "id": "competition",
                        "claim": "Microsoft's competitive cloud position remains defensible.",
                        "metric": "manual",
                        "minimum": "0",
                        "invalidation_condition": "Requires manual evidence review; no numerical invalidation rule.",
                    },
                ],
            }

    class Client:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def post(self, *_args, **_kwargs):
            return Response()

        def get(self, *_args, **_kwargs):
            return ResponseList()

    class ResponseList:
        def json(self):
            return []

    monkeypatch.setattr(
        "scripts.newcomer_live_validation.create_app",
        lambda *_args, **_kwargs: object(),
    )
    monkeypatch.setattr("scripts.newcomer_live_validation.TestClient", lambda *_args: Client())
    case = {
        "id": "suggest-microsoft-newcomer",
        "kind": "suggest",
        "instrument_id": "RMSFTUSDT",
        "rationale": "Microsoft cloud demand may remain durable while competition stays manageable.",
    }
    _output, checks = suggestion_checks(case, tmp_path, StubAttemptModel())
    assert all(checks.values())
