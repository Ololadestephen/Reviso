import json
import subprocess
from types import SimpleNamespace

import pytest

from backend.contracts import utc_now
from backend.market import normalized_market
from backend.providers import BitgetProvider


def test_bridge_is_fixed_read_only_and_does_not_inherit_credentials(monkeypatch):
    calls = []

    def run(args, **kwargs):
        calls.append((args, kwargs))
        return SimpleNamespace(returncode=0, stdout=json.dumps({"instrument_id": "RNVDAUSDT"}))

    monkeypatch.setenv("REViSO_TEST_SECRET", "must-not-leave-process")
    monkeypatch.setattr("backend.providers.shutil.which", lambda _: "/verified/node")
    monkeypatch.setattr("backend.providers.subprocess.run", run)
    provider = BitgetProvider()
    first, second = provider.snapshot(), provider.snapshot()
    assert first["availability"] == "UNAVAILABLE"
    assert second["cached"] is True
    assert len(calls) == 1
    args, options = calls[0]
    assert args[0] == "/verified/node" and args[1].endswith("/bridge/market.mjs")
    assert set(options["env"]) == {"PATH"}
    assert options["timeout"] == 22 and "shell" not in options


@pytest.mark.parametrize(
    "response", ["not json", "[]", '{"instrument_id":"OTHER"}', "x" * 1_000_001]
)
def test_bad_bridge_results_abstain(monkeypatch, response):
    monkeypatch.setattr("backend.providers.shutil.which", lambda _: "/verified/node")
    monkeypatch.setattr(
        "backend.providers.subprocess.run",
        lambda *a, **k: SimpleNamespace(returncode=0, stdout=response),
    )
    result = BitgetProvider().snapshot()
    assert result["availability"] == "UNAVAILABLE"
    assert result["observed_at"] is None and result["book_observed_at"] is None
    assert result["last_price"] is None and result["bids"] is None
    # A failed retrieval reports the same fields as a normalized one, with
    # nothing observed, so callers never branch on which keys exist.
    assert set(result) == set(normalized_market({}, utc_now())) | {"cached"}


def test_timeout_abstains(monkeypatch):
    def timeout(*args, **kwargs):
        raise subprocess.TimeoutExpired("fixed bridge", 22)

    monkeypatch.setattr("backend.providers.shutil.which", lambda _: "/verified/node")
    monkeypatch.setattr("backend.providers.subprocess.run", timeout)
    assert BitgetProvider().snapshot()["availability"] == "UNAVAILABLE"


def test_each_allowlisted_stock_has_an_isolated_cache_and_bridge_symbol(monkeypatch):
    calls = []

    def run(args, **_kwargs):
        symbol = args[-1]
        calls.append(symbol)
        return SimpleNamespace(returncode=0, stdout=json.dumps({"instrument_id": symbol}))

    monkeypatch.setattr("backend.providers.shutil.which", lambda _: "/verified/node")
    monkeypatch.setattr("backend.providers.subprocess.run", run)
    provider = BitgetProvider()
    assert provider.snapshot("RAAPLUSDT")["instrument_id"] == "RAAPLUSDT"
    assert provider.snapshot("RMSFTUSDT")["instrument_id"] == "RMSFTUSDT"
    assert provider.snapshot("RGOOGLUSDT")["instrument_id"] == "RGOOGLUSDT"
    assert provider.snapshot("RAMZNUSDT")["instrument_id"] == "RAMZNUSDT"
    assert provider.snapshot("RTSLAUSDT")["instrument_id"] == "RTSLAUSDT"
    assert provider.snapshot("RAAPLUSDT")["cached"] is True
    assert calls == [
        "RAAPLUSDT",
        "RMSFTUSDT",
        "RGOOGLUSDT",
        "RAMZNUSDT",
        "RTSLAUSDT",
    ]
