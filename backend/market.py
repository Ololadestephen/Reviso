"""Validate SDK responses before exposing prices or computing book capacity."""

from datetime import UTC, datetime
from decimal import Decimal

from backend.contracts import BookLevel, InstrumentId, ThesisInput
from backend.engines import walk_bids
from backend.instruments import NVIDIA, Instrument


def timestamp(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromtimestamp(int(value) / 1000, UTC)


def unavailable_market(
    now: datetime,
    instrument_id: InstrumentId,
    warnings: list[str],
    raw: dict | None = None,
) -> dict:
    """The single shape every market observation uses, with nothing observed.

    Success and failure must not differ in shape: a caller reading `last_price`
    should find it absent, never missing.
    """
    return {
        "instrument_id": instrument_id,
        "source": "https://api.bitget.com",
        "retrieved_at": now.isoformat(),
        "observed_at": None,
        "availability": "UNAVAILABLE",
        "last_price": None,
        "bid": None,
        "ask": None,
        "bids": None,
        "book_observed_at": None,
        "warnings": list(warnings),
        "raw": raw,
    }


def normalized_market(raw: dict, now: datetime, instrument: Instrument = NVIDIA) -> dict:
    supplied_warnings = raw.get("warnings")
    warnings = (
        [item for item in supplied_warnings if isinstance(item, str)]
        if isinstance(supplied_warnings, list)
        else []
    )
    result = unavailable_market(now, instrument.id, warnings, raw)
    warnings = result["warnings"]
    try:
        metadata = raw.get("instrument") or {}
        instruments = metadata.get("data") or []
        identity = next(
            (item for item in instruments if item.get("symbol") == instrument.provider_symbol),
            None,
        )
        if (
            not identity
            or identity.get("symbolType") != "stock"
            or identity.get("baseCoin") != instrument.base_coin
            or identity.get("quoteCoin") != instrument.quote_currency
        ):
            raise ValueError("Instrument identity cannot be verified")
        if identity.get("status") != "online":
            raise ValueError("Instrument is not online")
        ticker_data = (raw.get("ticker") or {}).get("data") or []
        ticker = next(
            (item for item in ticker_data if item.get("symbol") == instrument.provider_symbol),
            None,
        )
        if not ticker:
            raise ValueError("Matching ticker is unavailable")
        observed = timestamp(ticker.get("ts"))
        result["observed_at"] = observed.isoformat() if observed else None
        if observed is None or not -5 <= (now - observed).total_seconds() <= 120:
            raise ValueError("Ticker timestamp missing, stale or in the future")
        price = Decimal(ticker["lastPrice"])
        if not price.is_finite() or price <= 0:
            raise ValueError("Invalid ticker price")
        result.update(availability="AVAILABLE", last_price=str(price))
        book = (raw.get("book") or {}).get("data") or {}
        book_time = timestamp(book.get("ts"))
        result["book_observed_at"] = book_time.isoformat() if book_time else None
        if book_time is None or not -5 <= (now - book_time).total_seconds() <= 120:
            warnings.append("Visible book is stale or unavailable; depth is not evaluated.")
            return result
        bids = [BookLevel(price=str(p), quantity=str(q)) for p, q in book.get("b", [])]
        asks = [BookLevel(price=str(p), quantity=str(q)) for p, q in book.get("a", [])]
        if not bids or not asks:
            warnings.append("Book has a missing side; execution reference unavailable.")
            return result
        bid, ask = max(item.price for item in bids), min(item.price for item in asks)
        if bid > ask:
            warnings.append("Crossed book; execution reference unavailable.")
            return result
        result.update(
            bid=str(bid), ask=str(ask), bids=[item.model_dump(mode="json") for item in bids]
        )
        return result
    except (ValueError, TypeError, KeyError, AttributeError, ArithmeticError, OverflowError):
        warnings.append(
            "Provider data failed identity, timestamp or numeric validation. No inferred values."
        )
        result.update(availability="UNAVAILABLE", last_price=None, bid=None, ask=None, bids=None)
        return result


def market_execution(thesis: ThesisInput, market: dict) -> dict | None:
    if market.get("bids") is None or market.get("availability") != "AVAILABLE":
        return None
    midpoint = (Decimal(market["bid"]) + Decimal(market["ask"])) / 2
    result = walk_bids(
        thesis.proposed_amount / thesis.entry_price,
        [BookLevel.model_validate(item) for item in market["bids"]],
        midpoint,
    )
    return {
        **result,
        "mode": "LIVE_BOOK_SNAPSHOT",
        "instrument_id": thesis.instrument_id,
        "observed_at": market["book_observed_at"],
        "reference_midpoint": str(midpoint),
        "limitations": "Proposed quantity from your declared entry. Snapshot capacity is not a fill guarantee; fees and taxes excluded.",
    }
