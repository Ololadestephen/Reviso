from datetime import UTC, datetime, timedelta
from decimal import Decimal as D
from itertools import pairwise

import pytest
from pydantic import ValidationError

from backend.contracts import BookLevel, Reference, StressInput, ThesisInput
from backend.engines import premium, price_pnl, stress, walk_bids


def test_independent_execution_reference():
    # Independent cash-flow calculation: 3*99 + 2*98 = 493; average = 98.6.
    result = walk_bids(
        D(5), [BookLevel(price=98, quantity=8), BookLevel(price=99, quantity=3)], D(100)
    )
    assert D(result["proceeds"]) == 493
    assert D(result["vwap"]) == D("98.6")
    assert D(result["slippage_bps"]) == 140
    assert result["full_position_evaluable"]


def test_partial_and_empty_book():
    result = walk_bids(D(10), [BookLevel(price=100, quantity=3)], D(100))
    assert result["remainder"] == "7"
    assert not result["full_position_evaluable"]
    empty = walk_bids(D(10), [], D(100))
    assert empty["vwap"] is None and empty["slippage_bps"] is None


def test_price_boundary_and_fixed_shock_baseline(thesis):
    exact = stress(thesis, StressInput(price_move_pct=-10))
    assert D(exact["price_pnl"]) == -1000
    assert exact["loss_breach"] is False
    assert exact["breaking_move_pct"] == "-10.1"
    assert stress(thesis, StressInput(price_move_pct="-10.1"))["loss_breach"]
    # Fixed-shock baseline using integer cents: $10k at -20%, less 10bps fee => -$2008.
    assert price_pnl(D(10000), D(-20), D(10)) == D(-2008)


def test_monotonic_loss_and_repeatability(thesis):
    values = [price_pnl(D(10000), D(-shock), D(0)) for shock in range(101)]
    assert all(a >= b for a, b in pairwise(values))
    scenario = StressInput(bids=[BookLevel(price=100, quantity=90)], depth_multiplier="0.5")
    result = stress(thesis, scenario)
    assert result == stress(thesis, scenario)
    assert result["execution"]["full_position_pnl"] is None
    assert D(result["execution"]["remainder"]) == 55
    assert result["premium"] is None


def test_premium_rejects_mismatch():
    at = datetime(2026, 9, 10, tzinfo=UTC)
    share = Reference(
        underlying="NVDA", currency="USD", token_units_per_share=1, price=100, observed_at=at
    )
    token = share.model_copy(update={"price": D(101)})
    assert premium(token, share, at) == 1
    with pytest.raises(ValueError, match="stale"):
        premium(token, share, at + timedelta(minutes=2))
    for update in [
        {"currency": "USDT"},
        {"underlying": "TSLA"},
        {"observed_at": at - timedelta(minutes=2)},
    ]:
        with pytest.raises(ValueError):
            premium(token.model_copy(update=update), share, at)


@pytest.mark.parametrize(
    "field,value",
    [
        ("proposed_amount", "NaN"),
        ("entry_price", 0),
        ("direction", "short"),
        ("holding_days", 0),
        ("instrument_id", "BTCUSDT"),
    ],
)
def test_invalid_inputs_rejected(thesis, field, value):
    data = thesis.model_dump()
    data[field] = value
    with pytest.raises(ValidationError):
        ThesisInput.model_validate(data)


def test_duplicate_assumptions_rejected(thesis):
    data = thesis.model_dump()
    data["assumptions"].append(data["assumptions"][0])
    with pytest.raises(ValidationError):
        ThesisInput.model_validate(data)


def test_condition_text_cannot_disagree_with_numeric_rule(thesis):
    data = thesis.model_dump()
    data["assumptions"][0]["minimum"] = "70"
    with pytest.raises(ValidationError):
        ThesisInput.model_validate(data)


def test_derived_book_precision_is_not_limited_to_input_precision(thesis):
    scenario = StressInput(
        price_move_pct="-0.1",
        spread_bps="0.1",
        depth_multiplier="0.1",
        bids=[BookLevel(price="100.1234567891", quantity="0.1234567891")],
    )
    result = stress(thesis, scenario)["execution"]
    quantity = D("0.1234567891") * D("0.1")
    price = D("100.1234567891") * D("0.999") * D("0.999995")
    assert D(result["filled_quantity"]) == quantity
    assert D(result["proceeds"]) == quantity * price
