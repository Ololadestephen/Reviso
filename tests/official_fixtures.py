"""Synthetic official-document shapes, never claimed as real research."""

from datetime import UTC, datetime

NOW = datetime(2026, 10, 4, 12, tzinfo=UTC)
PERIOD = datetime(2026, 6, 30, tzinfo=UTC)
FED_URL = "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm"
FED_FEED_DOCUMENT = f"""<rss><channel><item><title>Federal Reserve issues FOMC statement</title>
<link>{FED_URL}</link><pubDate>Wed, 16 Sep 2026 18:00:00 GMT</pubDate></item></channel></rss>""".encode()
FED_DOCUMENT = (
    "<p>September 16, 2026</p><p>Recent indicators suggest that economic activity "
    + "has expanded at a steady pace. The Committee continues to assess inflation and employment. "
    * 8
    + "</p><p>Voting for the action.</p>"
).encode()


def bls_document(release):
    heading = "CONSUMER PRICE INDEX" if release == "cpi" else "THE EMPLOYMENT SITUATION"
    return (
        f"<pre>Transmission of material in this release is embargoed until\n"
        f"8:30 a.m. (ET) Friday, September 11, 2026 USDL-26-1496\n"
        f"{heading} - AUGUST 2026\n"
        + "Synthetic release paragraph with dated figures and explicit uncertainty. " * 12
        + "</pre>"
    ).encode()


def sec_index(instrument):
    return {
        "cik": int(instrument.issuer_cik),
        "name": instrument.issuer_name,
        "filings": {
            "recent": {
                "form": ["10-Q"],
                "filingDate": ["2026-07-24"],
                "reportDate": ["2026-06-30"],
                "accessionNumber": ["0000000000-26-000001"],
                "primaryDocument": ["report.htm"],
            }
        },
    }


def sec_document(instrument):
    return (
        f"<h1>{instrument.issuer_name}</h1><p>Item 2. Management discussion and analysis</p>"
        + "<p>Synthetic company discussion of business performance and uncertainties. " * 10
        + "</p>" * 10
        + "<p>Item 3. Market risk</p>Short section."
        + "<p>Item 1A. Risk factors</p><p>"
        + "Synthetic company risk warning. " * 20
        + "</p><p>Item 2. Other information</p>"
    ).encode()
