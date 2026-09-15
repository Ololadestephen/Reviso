"""Bounded public xStocks context, kept separate from Bitget and filing evidence."""

import json
import threading
import time
from decimal import Decimal, InvalidOperation

import httpx

from backend.contracts import InstrumentId, XStocksContext, utc_now
from backend.instruments import instrument_by_id

ORIGIN = "https://api.xstocks.fi"
RESEARCH_URL = "https://xstocks.fi/us/news"
MAX_BYTES = 500_000
XSTOCK_SYMBOLS: dict[InstrumentId, str] = {
    "RNVDAUSDT": "NVDAx",
    "RAAPLUSDT": "AAPLx",
    "RMSFTUSDT": "MSFTx",
    "RGOOGLUSDT": "GOOGLx",
    "RAMZNUSDT": "AMZNx",
    "RTSLAUSDT": "TSLAx",
}


def asset_url(instrument_id: InstrumentId) -> str:
    return f"{ORIGIN}/api/v2/public/assets/{XSTOCK_SYMBOLS[instrument_id]}"


def price_url(instrument_id: InstrumentId) -> str:
    return f"{asset_url(instrument_id)}/price-data"


def allowed_url(url: str) -> bool:
    return any(url in {asset_url(item), price_url(item)} for item in XSTOCK_SYMBOLS)


class XStocksProvider:
    def __init__(self, client: httpx.Client | None = None):
        self.client = client or httpx.Client(
            timeout=httpx.Timeout(10, connect=4),
            follow_redirects=False,
            headers={"Accept": "application/json", "User-Agent": "Reviso/0.1"},
        )
        self._lock = threading.Lock()
        self._cache: dict[InstrumentId, tuple[XStocksContext, float]] = {}

    def close(self):
        self.client.close()

    def _fetch(self, url: str) -> dict:
        if not allowed_url(url):
            raise ValueError("xStocks URL is outside the verified asset allowlist")
        with self.client.stream("GET", url, follow_redirects=False) as response:
            response.raise_for_status()
            if "application/json" not in response.headers.get("content-type", "").lower():
                raise ValueError("Expected xStocks JSON")
            content = bytearray()
            for chunk in response.iter_bytes():
                content.extend(chunk)
                if len(content) > MAX_BYTES:
                    raise ValueError("xStocks response exceeded the size limit")
        payload = json.loads(content)
        if not isinstance(payload, dict):
            raise TypeError("Expected an xStocks object")
        return payload

    def snapshot(self, instrument_id: InstrumentId) -> XStocksContext:
        with self._lock:
            cached = self._cache.get(instrument_id)
            if cached and time.monotonic() < cached[1]:
                return cached[0].model_copy(update={"cached": True}, deep=True)
            result = self._snapshot(instrument_id)
            ttl = 30 if result.availability == "UNAVAILABLE" else 300
            self._cache[instrument_id] = (result, time.monotonic() + ttl)
            return result.model_copy(deep=True)

    def _snapshot(self, instrument_id: InstrumentId) -> XStocksContext:
        now = utc_now()
        instrument = instrument_by_id(instrument_id)
        symbol = XSTOCK_SYMBOLS[instrument_id]
        base = {
            "instrument_id": instrument_id,
            "xstock_symbol": symbol,
            "retrieved_at": now,
            "source_url": price_url(instrument_id),
            "research_url": RESEARCH_URL,
            "limitations": [
                "This is a different tokenized product from the selected Bitget Reality token.",
                "The xStocks quote is indicative USD context, not a Bitget USDT order price.",
                "xStocks does not publish an observation time; retrieved_at is Reviso's fetch time.",
                "This is not registered share ownership or equivalent to company shares.",
                "xStocks availability and eligibility vary by jurisdiction; this is not an offer or recommendation.",
            ],
        }
        try:
            asset = self._fetch(asset_url(instrument_id))
            if asset.get("symbol") != symbol:
                raise ValueError("xStocks symbol did not match the allowlist")
            underlying = asset.get("underlying")
            if not isinstance(underlying, dict) or underlying.get("symbol") != instrument.ticker:
                raise ValueError("xStocks underlying did not match the selected company")
            trading = asset.get("trading")
            trading = trading if isinstance(trading, dict) else {}
            currency = trading.get("currency")
            if currency != "USD":
                raise ValueError("Expected an xStocks USD indicative quote")
            quote = self._fetch(price_url(instrument_id)).get("quote")
            price = Decimal(str(quote))
            if not price.is_finite() or price <= 0:
                raise ValueError("xStocks indicative price was absent or invalid")
            deployments = asset.get("deployments")
            deployment_items = deployments if isinstance(deployments, list) else []
            networks = sorted(
                {
                    item["network"]
                    for item in deployment_items
                    if isinstance(item, dict) and isinstance(item.get("network"), str)
                }
            )[:20]
            return XStocksContext(
                **base,
                name=str(asset.get("name") or symbol),
                underlying_symbol=instrument.ticker,
                currency=currency,
                indicative_price=price,
                availability="AVAILABLE",
                trading_halted=bool(asset.get("isTradingHalted")),
                market_open=(
                    trading.get("openNow") if isinstance(trading.get("openNow"), bool) else None
                ),
                trading_period=str(trading["currentPeriod"])
                if trading.get("currentPeriod")
                else None,
                networks=networks,
                warnings=[],
            )
        except (
            httpx.HTTPError,
            ValueError,
            TypeError,
            UnicodeError,
            json.JSONDecodeError,
            InvalidOperation,
        ) as error:
            return XStocksContext(
                **base,
                availability="UNAVAILABLE",
                warnings=[
                    f"xStocks public context unavailable ({type(error).__name__}); no value was substituted."
                ],
            )
