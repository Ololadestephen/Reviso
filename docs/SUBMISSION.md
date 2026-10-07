# Season 2 submission checklist

Submission-day target, October 7: the user has chosen to submit today. The exact organizer cutoff hour/time zone remains unconfirmed. Keep the dated rules below distinct from the user-supplied October 8 extension. The small user study belongs to the user; engineering checks are not study results or an official grade. Latest local checks: [chat citation verification](evaluations/2026-10-07-chat-citations.md).

Verified 2026-09-10 by following the Developer guide button in the live event page to [the Season 2 handbook](https://bitget-ai.gitbook.io/bitgetai_hackathons2). Direct crawler and the root `.md` URL failed earlier; the actual Markdown page linked by the handbook is `/bitgetai_hackathons2/base-camp-hackathon-s2-en.md`.

## Verified rules

- Track: AI Trading Desk. Sub-theme: Decision Stress Testing. Judges assess research quality, effective source/tool integration, natural-language interaction and a personalized thesis. This track uses judge scoring, not trading-return scoring.
- Required: accessible demo and a complete research task from question to actionable insight. Screen recording is optional; public code, docs and logs can accompany the demo.
- Complete the project description in the form itself. External links cannot replace it. Cover thesis/pain point, concrete target user and value, validation/metrics, progress, deliverables, and optionally perspective on AI trading. First three carry the most weight. Distinguish observed, estimated and target figures.
- Separate required field: actual LLM role and models used. The user retained sponsored Bitget Qwen 3.8 Max for extraction/review (Groq fallback), Groq `openai/gpt-oss-20b` for editable condition drafts, and Groq Qwen 3.8 27B for cited filing follow-ups. Gemini is implemented and tested on a constructed example, but is not selected for the submission's normal app traffic. A 21-case live calibration used 25 provider requests; response-shape failures left only one full application pass. A subsequent frozen five-case v2 validation passed using five first-attempt requests. The October 4 supplemental-source batch had three contract passes but one partial source-fidelity result. Its citation defect was fixed offline; the new chat prompt awaits a fresh approved live check. State the small constructed scope; do not claim general research accuracy.
- Required X promotional post: introduce the product and include `#BitgetHackathon` and `@Bitget_AI`. The October 7 handbook inspection provides the [official kickoff post](https://x.com/Bitget_AI/status/2100519318824055159?s=20) to quote. No X post means incomplete submission. No post has been published by this preparation.
- [Official submission form](https://forms.gle/GyWZCMCPocgJdJon6). No separate registration is required. At most two independent projects/themes per team, each in a separate form entry. Do not submit simple renames/minor ports of Season 1 work.
- Optional fields include university, Demo Day and K3 subsidy. The Qwen build-credit application was granted on September 11; the credential remains server-side and must not appear in submission materials.

## Deadline uncertainty

The user supplied [an organizer X link](https://x.com/Bitget_AI/status/2106225469242958312?s=20) for an October 8 extension. That post's contents and exact cutoff have not been independently verified here. Do not assume 23:59 or a time zone. Internal target: October 7 Lagos, not an official cutoff.

The September 10 handbook inspection recorded September 3–21 UTC+8, conflicting judging windows and an announcement around October 8. Those historical dates must not be substituted for the newer user-supplied extension. Organizer clarification is still needed; no message has been sent.

## Reviso release gates

- [x] Local end-to-end replay with explicit confirmation and revisions.
- [x] SDK public rNVDA ticker/book observed successfully.
- [x] Provider-neutral Bitget Qwen-first extraction and narrative-review path implemented with Groq/manual fallback.
- [x] First real narrative calibration and plain-prompt baseline run against a frozen constructed corpus; failures recorded.
- [x] Offline v2 response-contract compatibility changes implemented from batch 01 evidence.
- [x] Newly frozen five-case v2 validation holdout evaluated successfully under a 10-request cap (5 used).
- [x] Public NVIDIA quarterly earnings retrieval beyond the bundled replay, with saved citations and conservative parsing.
- [ ] User task-completion evaluation (user-owned small study); no figures invented.
- [ ] Independent plain-LLM research baseline beyond the existing constructed calibration.
- [ ] Exact deadline/official promotional post confirmed.
- [x] AWS Lightsail, persistent SQLite and Google owner-scoped access implemented; historical deployment reports retained.
- [x] Local October research/source/chat improvements verified with mocks and disposable replay.
- [x] Final bounded chat regression approved and passed: one request, no repair, sourced reply and persistence. This is not an independent benchmark.
- [x] October release approved, backed up, signed/pushed and deployed; public pages, source retrieval and account/data preservation verified.
- [ ] User signed-in live check: reopen existing research.
- [ ] Final X post and submission approved by user.

## Project description draft — not submitted

Reviso helps individual researchers write down what would change their mind about a stock idea. Instead of asking a chatbot for a buy-or-sell answer, they choose a company, explain their idea, confirm a few conditions, inspect dated company evidence, and record their own decision.

The current selection covers six familiar companies. Official Bitget tools supply the selected token's market context; NVIDIA releases or issuer-bound SEC facts supply company evidence. These stay separate, as does optional xStocks indicative-price context. Reviso uses Decimal arithmetic to compare reported metrics with the user's confirmed limits. Missing evidence remains missing.

AI helps draft editable conditions, explain the saved result and answer filing-bound questions with source links. The server checks schemas, source IDs and numerical review consistency; it does not treat that as proof every sentence is correct. Google sign-in separates notebooks. Previous versions, findings and human decisions remain saved and can be exported.

Local verification now has 241 backend and 121 frontend passing tests, static/format checks and a production build. Earlier live calibration and validation reports include successes and failures; the final chat attribution regression passed with one request and no repair on October 7. The user study is pending with the project owner. No general accuracy, investment return or guaranteed response-time claim is made.

## Draft X post — not published

Building Reviso for #BitgetHackathon: know what would change your mind. Turn a trade idea into explicit assumptions, stress-test the downside, and track the evidence that challenges your original rationale. Human decision, visible sources. @Bitget_AI

Add the verified demo URL, recording and official-post interaction before approval/publication. Do not imply AI runtime capabilities until configured and tested.
