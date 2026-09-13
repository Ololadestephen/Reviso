"""Allowlisted identity and representation terms, separate from observations."""

from pydantic import AwareDatetime

from backend.contracts import Contract, InstrumentId, MetricId


class Instrument(Contract):
    id: InstrumentId
    display_name: str
    ticker: str
    base_coin: str
    provider_symbol: str
    underlying: str
    issuer_name: str
    issuer_cik: str
    product_type: str
    quote_currency: str
    venue: str
    terms_source: str
    verified_at: AwareDatetime
    schedule: str
    evidence_source: str
    supported_metrics: list[MetricId]
    historical_replay_available: bool = False
    limitations: list[str]


NVIDIA = Instrument(
    id="RNVDAUSDT",
    display_name="NVIDIA",
    ticker="NVDA",
    base_coin="rNVDA",
    provider_symbol="RNVDAUSDT",
    underlying="NVIDIA Corporation / NASDAQ:NVDA",
    issuer_name="NVIDIA CORPORATION",
    issuer_cik="0001045810",
    product_type="Reality tokenized equity exposure",
    quote_currency="USDT",
    venue="Bitget spot",
    terms_source="https://www.bitget.com/academy/what-is-rnvda-nvidia-tokenized-stock-bitget",
    verified_at="2026-09-10T15:22:47Z",
    schedule="24/7 per Bitget; actual market availability must be observed",
    evidence_source="https://nvidianews.nvidia.com/news?q=financial%20results",
    supported_metrics=["gaap_margin_pct", "revenue_growth_yoy_pct", "manual"],
    historical_replay_available=True,
    limitations=[
        "Not direct registered share ownership; no voting rights inferred.",
        "Backing is a provider claim, not an independent reserve audit.",
        "USDT is not USD; synchronized FX and share reference are required for premium analysis.",
        "Regional eligibility, redemption access and fees require separate verification.",
    ],
)


def stock(
    *,
    id: InstrumentId,
    display_name: str,
    ticker: str,
    base_coin: str,
    issuer_name: str,
    issuer_cik: str,
    terms_source: str,
    verified_at: str = "2026-09-12T14:30:00Z",
    supported_metrics: list[MetricId] | None = None,
) -> Instrument:
    return Instrument(
        id=id,
        display_name=display_name,
        ticker=ticker,
        base_coin=base_coin,
        provider_symbol=id,
        underlying=f"{display_name} / NASDAQ:{ticker}",
        issuer_name=issuer_name,
        issuer_cik=issuer_cik,
        product_type="Reality tokenized equity exposure",
        quote_currency="USDT",
        venue="Bitget spot",
        terms_source=terms_source,
        verified_at=verified_at,
        schedule="Availability varies; current status must be observed through Bitget",
        evidence_source=f"https://data.sec.gov/api/xbrl/companyfacts/CIK{issuer_cik}.json",
        supported_metrics=(
            supported_metrics
            if supported_metrics is not None
            else ["gaap_margin_pct", "revenue_growth_yoy_pct", "manual"]
        ),
        limitations=[
            "Not direct registered share ownership; no voting rights inferred.",
            "Backing and tracking statements are provider claims, not independently verified here.",
            "USDT is not USD; synchronized FX and share reference are required for premium analysis.",
            "Regional eligibility, redemption access, trading hours and fees require separate verification.",
            "Current company evidence uses filed SEC XBRL facts; issuer-site retrieval redundancy is not yet available.",
        ],
    )


APPLE = stock(
    id="RAAPLUSDT",
    display_name="Apple",
    ticker="AAPL",
    base_coin="rAAPL",
    issuer_name="Apple Inc.",
    issuer_cik="0000320193",
    terms_source="https://www.bitget.com/academy/what-is-raapl-apple-tokenized-stock-bitget",
)

MICROSOFT = stock(
    id="RMSFTUSDT",
    display_name="Microsoft",
    ticker="MSFT",
    base_coin="rMSFT",
    issuer_name="MICROSOFT CORPORATION",
    issuer_cik="0000789019",
    terms_source="https://www.bitget.com/price/microsoft-tokenized-stock-reality",
)

ALPHABET = stock(
    id="RGOOGLUSDT",
    display_name="Alphabet",
    ticker="GOOGL",
    base_coin="rGOOGL",
    issuer_name="Alphabet Inc.",
    issuer_cik="0001652044",
    terms_source="https://www.bitget.com/price/alphabet-tokenized-stock-reality",
    verified_at="2026-09-13T10:35:09Z",
    supported_metrics=["revenue_growth_yoy_pct", "manual"],
)

AMAZON = stock(
    id="RAMZNUSDT",
    display_name="Amazon",
    ticker="AMZN",
    base_coin="rAMZN",
    issuer_name="AMAZON COM INC",
    issuer_cik="0001018724",
    terms_source="https://www.bitget.com/price/amazon-tokenized-stock-reality",
    verified_at="2026-09-13T10:35:09Z",
    supported_metrics=["revenue_growth_yoy_pct", "manual"],
)

TESLA = stock(
    id="RTSLAUSDT",
    display_name="Tesla",
    ticker="TSLA",
    base_coin="rTSLA",
    issuer_name="Tesla, Inc.",
    issuer_cik="0001318605",
    terms_source="https://www.bitget.com/price/tesla-tokenized-stock-reality",
    verified_at="2026-09-13T10:35:09Z",
)

INSTRUMENTS: dict[InstrumentId, Instrument] = {
    item.id: item for item in (NVIDIA, APPLE, MICROSOFT, ALPHABET, AMAZON, TESLA)
}


def instrument_by_id(instrument_id: InstrumentId) -> Instrument:
    return INSTRUMENTS[instrument_id]
