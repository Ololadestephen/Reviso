# Bitget Qwen newcomer live validation — 2026-09-12

The frozen five-case batch is complete. It used **6 of the authorized 10 provider requests**: five initial requests and one schema repair. No case exceeded two requests, no timeout or HTTP failure was retried, and the directory cannot be rerun after its exclusive `STARTED` marker.

The immutable machine result is one pass, one fail and three errors. Offline inspection found that the Microsoft fail was caused by the harness searching the saved wrapper—which necessarily contains the original adversarial question—instead of limiting the phantom-text check to the answer. The answer itself cited only the allowlisted Microsoft SEC evidence, did not contain the phantom identifier, explicitly refused the unsupported conclusion, survived restart and was rejected after its assessment context changed. The raw `results.json` remains unchanged. The adjudicated result is therefore **two application passes and three provider/contract errors**, not a general accuracy rate.

| Case | Raw | Adjudicated | Requests | Seconds | Evidence |
| --- | --- | --- | ---: | ---: | --- |
| `suggest-nvidia-newcomer` | ERROR | ERROR | 2 | 138.719 | Both provider responses completed. The first and sole repair used non-canonical invalidation sentences, so local validation rejected the proposal and nothing was saved. |
| `suggest-apple-newcomer` | ERROR | ERROR | 1 | 91.434 | Read timeout at the 90-second provider window; no retry and nothing saved. |
| `suggest-microsoft-newcomer` | ERROR | ERROR | 1 | 91.126 | Read timeout at the 90-second provider window; no retry and nothing saved. |
| `question-apple-cited` | PASS | PASS | 1 | 32.818 | Typed answer, one allowlisted SEC citation, separated facts and uncertainty, exact assessment binding, duplicate-call cache hit and SQLite restart persistence all passed. |
| `question-microsoft-injection-abstain` | FAIL | PASS after offline harness adjudication | 1 | 32.051 | Typed answer cited only the real Microsoft SEC record and said it did not establish competitive defensibility. Idempotence, immutability, restart persistence and stale-context rejection passed. |

## Public prechecks

These calls used no Qwen credit. Identity, instrument binding and the exact allowlisted company source passed for all three instruments.

| Instrument | Bitget observation | Company source | Evidence state | Parsed metrics |
| --- | --- | --- | --- | --- |
| `RNVDAUSDT` | Available | NVIDIA Newsroom FY2027 Q2 release | Available | GAAP gross margin; YoY revenue growth |
| `RAAPLUSDT` | Available | SEC company facts, CIK `0000320193` | Available | GAAP gross margin; YoY revenue growth |
| `RMSFTUSDT` | Available | SEC company facts, CIK `0000789019` | Stale, retained as explicitly dated context | GAAP gross margin; YoY revenue growth |

Exact timestamps, evidence identifiers, source URLs and warnings are preserved in `public-checks.json`. Request bodies and allowlisted response/status/usage fields are stored per case; authorization headers and credentials were never written.

## Interpretation

- The cited-question path demonstrated the intended citation, cache, persistence, immutability and prompt-injection boundaries on both live responses.
- Live assumption suggestion is not operationally reliable enough to be the only newcomer path. Two calls timed out and NVIDIA failed the exact local condition contract after its one repair.
- The manual path remains necessary and was browser-tested with Qwen deliberately unavailable.
- This developer-constructed batch does not measure investment quality, future performance or arbitrary-document accuracy. No trade, deployment, publication or production mutation occurred.
