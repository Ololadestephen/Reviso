import json

import httpx

from backend.xstocks import XStocksProvider, allowed_url, asset_url, price_url


def response(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("/price-data"):
        body = {"quote": 213.645}
    else:
        body = {
            "name": "NVIDIA xStock",
            "symbol": "NVDAx",
            "underlying": {"symbol": "NVDA"},
            "isTradingHalted": False,
            "trading": {
                "currency": "USD",
                "openNow": True,
                "currentPeriod": "overnight",
            },
            "deployments": [
                {"network": "Solana"},
                {"network": "Ethereum"},
                {"network": "Solana"},
            ],
        }
    return httpx.Response(
        200,
        headers={"content-type": "application/json"},
        content=json.dumps(body),
    )


def test_xstocks_context_keeps_identity_and_price_provenance_separate():
    with httpx.Client(transport=httpx.MockTransport(response)) as client:
        context = XStocksProvider(client).snapshot("RNVDAUSDT")

    assert context.availability == "AVAILABLE"
    assert context.xstock_symbol == "NVDAx"
    assert context.underlying_symbol == "NVDA"
    assert str(context.indicative_price) == "213.645"
    assert context.currency == "USD"
    assert context.networks == ["Ethereum", "Solana"]
    assert "different tokenized product" in context.limitations[0]
    assert any("not registered share" in item.lower() for item in context.limitations)
    assert any("observation time" in item.lower() for item in context.limitations)
    assert context.source_url == price_url("RNVDAUSDT")


def test_xstocks_context_fails_closed_on_foreign_underlying():
    def foreign(request: httpx.Request) -> httpx.Response:
        result = response(request)
        if not request.url.path.endswith("/price-data"):
            body = result.json()
            body["underlying"]["symbol"] = "AAPL"
            return httpx.Response(
                200,
                headers={"content-type": "application/json"},
                json=body,
            )
        return result

    with httpx.Client(transport=httpx.MockTransport(foreign)) as client:
        context = XStocksProvider(client).snapshot("RNVDAUSDT")

    assert context.availability == "UNAVAILABLE"
    assert context.indicative_price is None
    assert "no value was substituted" in context.warnings[0]


def test_xstocks_url_allowlist_is_exact():
    assert allowed_url(asset_url("RAAPLUSDT"))
    assert allowed_url(price_url("RAAPLUSDT"))
    assert not allowed_url("https://api.xstocks.fi/api/v2/public/assets/UNKNOWN")
    assert not allowed_url("https://example.com/api/v2/public/assets/AAPLx")
