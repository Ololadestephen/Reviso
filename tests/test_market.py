from datetime import UTC, datetime, timedelta

from backend.instruments import APPLE
from backend.market import market_execution, normalized_market


def sample(at):
    ts = str(int(at.timestamp() * 1000))
    return {
        "instrument": {
            "data": [
                {
                    "symbol": "RNVDAUSDT",
                    "symbolType": "stock",
                    "baseCoin": "rNVDA",
                    "quoteCoin": "USDT",
                    "status": "online",
                }
            ]
        },
        "ticker": {"data": [{"symbol": "RNVDAUSDT", "ts": ts, "lastPrice": "100"}]},
        "book": {"data": {"ts": ts, "b": [["99", "30"]], "a": [["101", "30"]]}},
        "warnings": [],
    }


def test_live_snapshot_and_insufficient_depth(thesis):
    at = datetime(2026, 9, 10, tzinfo=UTC)
    market = normalized_market(sample(at), at)
    assert market["availability"] == "AVAILABLE"
    assert market["observed_at"] == at.isoformat()
    result = market_execution(thesis, market)
    assert result["proceeds"] == "2970"
    assert result["remainder"] == "70"
    assert result["mode"] == "LIVE_BOOK_SNAPSHOT"


def test_stale_wrong_instrument_and_malformed_abstain():
    at = datetime(2026, 9, 10, tzinfo=UTC)
    assert normalized_market(sample(at), at + timedelta(minutes=3))["availability"] == "UNAVAILABLE"
    raw = sample(at)
    raw["instrument"]["data"][0]["baseCoin"] = "NVDAON"
    assert normalized_market(raw, at)["last_price"] is None
    for raw in [{}, {"instrument": {"data": "unexpected"}}, {"ticker": "bad"}]:
        assert normalized_market(raw, at)["availability"] == "UNAVAILABLE"


def test_missing_book_does_not_become_zero_liquidity():
    at = datetime(2026, 9, 10, tzinfo=UTC)
    raw = sample(at)
    raw["book"] = None
    market = normalized_market(raw, at)
    assert market["availability"] == "AVAILABLE"
    assert market["bids"] is None


def test_quote_currency_and_malformed_warnings():
    at = datetime(2026, 9, 10, tzinfo=UTC)
    raw = sample(at)
    raw["warnings"] = None
    assert normalized_market(raw, at)["availability"] == "AVAILABLE"
    raw["instrument"]["data"][0]["quoteCoin"] = "USD"
    assert normalized_market(raw, at)["availability"] == "UNAVAILABLE"


def test_market_identity_is_bound_to_the_selected_stock():
    at = datetime(2026, 9, 10, tzinfo=UTC)
    raw = sample(at)
    raw["instrument"]["data"][0].update(symbol="RAAPLUSDT", baseCoin="rAAPL")
    raw["ticker"]["data"][0]["symbol"] = "RAAPLUSDT"
    market = normalized_market(raw, at, APPLE)
    assert market["availability"] == "AVAILABLE"
    assert market["instrument_id"] == "RAAPLUSDT"
    assert normalized_market(sample(at), at, APPLE)["availability"] == "UNAVAILABLE"
