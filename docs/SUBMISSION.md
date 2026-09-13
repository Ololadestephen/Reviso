# Season 2 submission checklist

Verified 2026-09-10 by following the Developer guide button in the live event page to [the Season 2 handbook](https://bitget-ai.gitbook.io/bitgetai_hackathons2). Direct crawler and the root `.md` URL failed earlier; the actual Markdown page linked by the handbook is `/bitgetai_hackathons2/base-camp-hackathon-s2-en.md`.

## Verified rules

- Track: AI Trading Desk. Sub-theme: Decision Stress Testing. Judges assess research quality, effective source/tool integration, natural-language interaction and a personalized thesis. This track uses judge scoring, not trading-return scoring.
- Required: accessible demo and a complete research task from question to actionable insight. Screen recording is optional; public code, docs and logs can accompany the demo.
- Complete the project description in the form itself. External links cannot replace it. Cover thesis/pain point, concrete target user and value, validation/metrics, progress, deliverables, and optionally perspective on AI trading. First three carry the most weight. Distinguish observed, estimated and target figures.
- Separate required field: actual LLM role and models used. Reviso has contract-tested adapters for sponsored Bitget Qwen 3.8 Max and fallback Qwen 3.8 27B on Groq. A 21-case live calibration used 25 provider requests. Raw judgments matched the small constructed narrative set, but response-shape failures left only one full application pass. After compatibility changes, a frozen five-case v2 validation passed extraction, mixed evidence, injection resistance, abstention and saved-review integration using five first-attempt requests. State the small constructed scope; do not claim general research accuracy.
- Required X promotional post: introduce the product and include `#BitgetHackathon` and `@Bitget_AI`. Handbook also asks for a retweet of the official post, but that link is still marked TBD. No X post means incomplete submission.
- [Official submission form](https://forms.gle/GyWZCMCPocgJdJon6). No separate registration is required. At most two independent projects/themes per team, each in a separate form entry. Do not submit simple renames/minor ports of Season 1 work.
- Optional fields include university, Demo Day and K3 subsidy. The Qwen build-credit application was granted on September 11; the credential remains server-side and must not appear in submission materials.

## Deadline uncertainty

The handbook states September 3–21, 2026, UTC+8, and elsewhere says before September 21. It does not give an hour/minute. Therefore an exact cutoff is NOT verified. Do not assume 23:59. Internal target: finish submission materials by September 20 Lagos time, allowing time to resolve the ambiguity with organizers. This is a planning target, not an official cutoff.

Voting/judging dates conflict within the handbook: some sections say September 22–28; others say September 22–October 7. Winner announcement is listed around October 8. Organizer clarification is needed. No message has been sent to organizers.

## Reviso release gates

- [x] Local end-to-end replay with explicit confirmation and revisions.
- [x] SDK public rNVDA ticker/book observed successfully.
- [x] Provider-neutral Bitget Qwen-first extraction and narrative-review path implemented with Groq/manual fallback.
- [x] First real narrative calibration and plain-prompt baseline run against a frozen constructed corpus; failures recorded.
- [x] Offline v2 response-contract compatibility changes implemented from batch 01 evidence.
- [x] Newly frozen five-case v2 validation holdout evaluated successfully under a 10-request cap (5 used).
- [x] Public NVIDIA quarterly earnings retrieval beyond the bundled replay, with saved citations and conservative parsing.
- [ ] User task-completion evaluation and plain-LLM baseline.
- [ ] Exact deadline/official promotional post confirmed.
- [ ] Host, persistence and private-record access controls selected.
- [ ] Public deployment, X post and submission approved by user.

## Draft X post — not published

Building Reviso for #BitgetHackathon: know what would change your mind. Turn a trade idea into explicit assumptions, stress-test the downside, and track the evidence that challenges your original rationale. Human decision, visible sources. @Bitget_AI

Add the verified demo URL, recording and official-post interaction before approval/publication. Do not imply AI runtime capabilities until configured and tested.
