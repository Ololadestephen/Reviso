# Groq availability diagnostic — 7 October 2026

## Result

The reported `groq response unavailable (HTTPStatusError)` was **not reproduced**.
Keep the current providers rather than switching without evidence. Groq chat is
working for the two tested public NVIDIA packets; this does not guarantee every
request or explain the earlier failure.

An authenticated model-catalogue GET on the AWS application returned HTTP 200.
Both configured models were available: chat `qwen/qwen3.8-27b`, draft
`openai/gpt-oss-20b`. Existing application logs did not contain the original HTTP
status or response code, so no root cause can be assigned retrospectively.

The user then approved **at most two inference requests including repairs**.
Both requests used the existing AWS chat configuration with public evidence
from the unchanged October 7 evaluation packet, not anyone's notebook:

| Check | HTTP | Time | Local answer validation | Requests |
| --- | --- | --- | --- | --- |
| Financial excerpt and three confirmed public-sample conditions | 200 | 2.674 s | Passed | 1 |
| Larger financial/official-research packet and in-memory numerical finding | 200 | 1.237 s | Passed | 1 |

Both were direct provider-boundary diagnostics, not signed-in browser tests.
The first used no saved-finding context; the second computed one in memory.
They used the public sample's 120% growth and 75% margin floors, **not** the
user's screenshot's 80% growth floor. The second correctly limited demand claims
to the supplied management-discussion opening and identified missing peer data.
No repair was attempted, and no third request is authorized. A transport cap
enforced two requests for the first action and the one remaining request for
the second. No production record, allowance row or account was modified by
these direct diagnostics. Provider usage is still real and counted by Groq.

## Local change

HTTP errors now produce a safe, actionable message instead of only an exception
class. Status and an allowlisted error code are logged; upstream messages,
failed generations, questions and credentials are not copied to the log/UI.
The existing API HTTP 503/detail contract is retained. Provider HTTP 429 can
also supply a bounded, rounded-up `Retry-After` header and wait time. No wait
time is invented when absent, and no automatic network retry or provider
fallback is added. Other failures distinguish authorization, missing model,
context size, output formatting, rejected requests and temporary outages.

The classification follows the official [Groq error documentation](https://console.groq.com/docs/errors)
and [rate-limit header documentation](https://console.groq.com/docs/rate-limits).
Successful diagnostics do not establish that the earlier error was a rate limit,
schema error or outage. An intermittent failure still needs its actual status.

Ruff checks/formatting, `git diff --check`, and **274 backend tests** passed.
Mock HTTP tests cover status categories, malformed bodies, private-data
redaction, retry bounds, no retries and API compatibility. Existing two test
dependency deprecation warnings remain. No frontend contract change was made.

No new commit, push, deployment, provider switch, secret change, or SQLite
mutation. The user's earlier UI/script changes remain untouched. Publishing
the improved error handling still requires separate approval.

## Quality checks

Backend scan, status and next ran before implementation and after verification.
Two findings introduced by the first implementation (branch complexity and
an unnamed retry bound) were corrected and the final rescan cleared both.
The final 81 open findings match the initial open count. Existing broad cleanup
and subjective review are outside this focused fix; none are suppressed or
invented. Bandit was unavailable to the scanner, reducing security coverage.
These are code-health measurements, not research accuracy or judging scores.

| Aggregate | Before | Final |
| --- | --- | --- |
| Overall / lenient | 23.1 | 23.2 |
| Objective | 92.6 | 92.8 |
| Strict | 22.1 | 22.2 |
| Verified | 92.6 | 92.8 |

| Mechanical dimension | Health | Strict |
| --- | --- | --- |
| Code quality | 89.9 | 85.7 |
| Duplication | 100.0 | 100.0 |
| File health | 87.3 | 85.2 |
| Security | 99.1 | 95.8 |
| Test health | 88.2 | 79.4 |

All subjective dimensions below are **unassessed**, represented as zero by the
scanner, not independent review judgments:

| Subjective dimension | Scanner score |
| --- | --- |
| Abstraction fit | 0.0 |
| AI-generated debt | 0.0 |
| API coherence | 0.0 |
| Authorization consistency | 0.0 |
| Contracts | 0.0 |
| Convention outlier | 0.0 |
| Cross-module architecture | 0.0 |
| Dependency health | 0.0 |
| Design coherence | 0.0 |
| Error consistency | 0.0 |
| High elegance | 0.0 |
| Incomplete migration | 0.0 |
| Initialization coupling | 0.0 |
| Logic clarity | 0.0 |
| Low elegance | 0.0 |
| Mid elegance | 0.0 |
| Naming quality | 0.0 |
| Package organization | 0.0 |
| Test strategy | 0.0 |
| Type safety | 0.0 |

## Subsequently approved publication

The user approved signed commit/push and AWS deployment. Code release `64945e4`
is live after the integrity-checked production backup, exact row preservation
check and public/protected HTTP checks. No further AI request was made. See
[the release and recovery report](2026-10-07-groq-release.md).
