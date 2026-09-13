# Verified stock research coverage

Checked September 12, 2026. This is an explicit allowlist, not a claim that Reviso supports arbitrary equities. A company is enabled only when its Bitget market identity and an issuer-bound official evidence path are both represented in code and synthetic failure fixtures.

| Company | Reviso / Bitget ID | Token | Quote | Issuer identity | Current evidence route | Recovery route | Research capability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NVIDIA | `RNVDAUSDT` | `rNVDA` | USDT | NVIDIA CORPORATION, CIK 0001045810 | NVIDIA newsroom quarterly financial-results release | SEC company facts only when newsroom retrieval is unavailable; retrieval redundancy, not corroboration | Current evidence plus the labeled two-step historical company-disclosure example |
| Apple | `RAAPLUSDT` | `rAAPL` | USDT | Apple Inc., CIK 0000320193 | SEC company facts | None beyond bounded retry/cache | Current filed quarterly facts |
| Microsoft | `RMSFTUSDT` | `rMSFT` | USDT | MICROSOFT CORPORATION, CIK 0000789019 | SEC company facts | None beyond bounded retry/cache | Current filed quarterly facts |

## Verification sources

- Bitget's official [rToken campaign](https://www.bitget.com/campaigns/bitget-rtoken) identifies the supported Reality tokenized stock family. The public Bitget v2 spot-symbol catalog returned all three exact symbols with `symbolType=stock`, the listed base/quote identities and `status=online` during the September 12 check. Runtime status is still observed on each request and may later be unavailable.
- NVIDIA representation terms: [Bitget rNVDA product article](https://www.bitget.com/academy/what-is-rnvda-nvidia-tokenized-stock-bitget).
- Apple representation terms: [Bitget rAAPL product article](https://www.bitget.com/academy/what-is-raapl-apple-tokenized-stock-bitget).
- Microsoft representation terms: [Bitget rMSFT price page](https://www.bitget.com/price/microsoft-tokenized-stock-reality).
- NVIDIA primary evidence: [NVIDIA Newsroom financial-results search](https://nvidianews.nvidia.com/news?q=financial%20results).
- Official SEC company facts: [NVIDIA](https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json), [Apple](https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json), and [Microsoft](https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json).

## Metric policy

The SEC parser accepts only aligned quarterly USD duration facts filed no later than the retrieval date. It derives year-over-year revenue growth from the matching prior-year quarter and GAAP gross margin from gross profit divided by revenue for the same period and filing context. Missing, ambiguous, future-filed or misaligned facts stay absent. Partial coverage remains partial; an older filing is not promoted as a successful current refresh.

Supported assumption measures are reported GAAP gross margin, reported year-over-year revenue growth, and explicit manual research. This list does not imply that both numerical measures will be present in every filing. Guidance and non-GAAP values are not substituted.

## Boundaries

- These instruments provide tokenized exposure on Bitget; Reviso does not describe them as registered shares, voting ownership or guaranteed one-for-one redemption.
- USDT is not USD. Reviso has no synchronized share reference or FX feed and therefore does not calculate a token/share premium.
- Market observations are dated public Bitget snapshots, not entry assumptions, fills or liquidity guarantees.
- The SEC feed is an official filing dataset, not an independent corroborating source. NVIDIA's SEC fallback is a recovery path for retrieval, not a second vote for the same fact.
- Apple and Microsoft do not have a second issuer-site retrieval path in this slice. The UI must report that limitation rather than imply resilience.
- Eligibility, regional access, backing, redemption, fees and trading availability require separate current verification.

