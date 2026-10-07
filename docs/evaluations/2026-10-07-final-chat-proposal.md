# Final chat check proposal — 7 October 2026

Prepared only: no AI requests or production changes. The user chose to retain
the current explanation provider. Bitget Qwen stays on extraction/review, Groq
stays on drafts/chat, and Gemini is not activated.

## Proposed request

One Groq follow-up, at most two provider requests including its single allowed
repair. No review, draft, Gemini call, automatic network retry or batch rerun.
Freeze an executable manifest and its code/packet hashes before any request;
save a STARTED marker and count before network access. Live approval is pending.

Use the previously frozen public NVIDIA packet, not a real user's notebook:
`official-ai-2026-10-04/packet.json`. Its SHA-256 is
`4408724c9703cfe90ec508b0a5836c3ffb30cb095240cfb4478242692029c9d0`.
These are dated saved excerpts, not a claim of latest October 7 evidence. This is
a regression smoke check of the known defect, not a new independent holdout.
Use a new isolated SQLite notebook; never rerun the completed October 4 batch.

Question: “What does the saved NVIDIA management discussion say about demand?
Cite that report passage, distinguish company statements from independent proof,
and explain what peer comparison is still missing.”

Freeze these expectations before execution:

1. Describe only the supplied selected opening; do not assert the full report
   contains no demand discussion. Admit that the opening is cautionary text.
2. Cite the company report for commentary. Do not treat it as independent proof
   or invent a peer comparison.
3. Avoid irrelevant financial figures. If included, cite their financial source
   in the actual statement and faithfully use the supplied values.
4. Keep the saved constructed findings unchanged: growth 106% misses the 120%
   minimum; margin 75% meets 75%; peer demand remains insufficient.
5. No phantom source, buy/sell decision or invented metric. Total visible reply
   must be at most 70 words; inspect qualitative source fidelity manually.
6. Repeat the same cached action without a provider request; verify citations,
   storage, restart, export and original-check immutability.

Record raw output, actual request count, latency, repair count and provider usage
when available. Separate application-contract checks from manual source-fidelity
judgment. A failed result is retained; additional requests require new approval.

## Read-only release preflight

The live landing, `/app` and `/api/health` returned HTTP 200 on October 7. Health
reports Bitget Qwen configured, Google auth, `evidence-review-v3` and
`research-question-v2`: today's local v5 chat fix is not deployed. HTTP 200 is
not a signed-in journey or proof of research correctness.

`reviso-deploy` fails STS identity lookup because its login session is expired
and configured for root. Do not reauthenticate as root. Read-only STS verification
succeeded with `reviso-deployer-key`, authenticated as IAM user `reviso-deployer`.
`reviso-iam` has no credentials. Use the verified non-root profile for an approved
release. No login, firewall change or deployment was performed.

Next, after explicit release approval: verify a non-root deployment identity,
integrity-check an online production SQLite backup, preserve host secrets and
named volumes, publish the reviewed Git tree, deploy and test the signed-in live
journey. Do not enable billed snapshots without separate approval.
