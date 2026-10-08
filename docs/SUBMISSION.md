# Season 2 submission

Reviso enters **AI Trading Desk → Decision Stress Testing**.

The user reported the submission cutoff as **8 October 2026, 23:59 UTC+8**
(16:59 in Lagos). The handbook still contains earlier September dates;
this note does not claim independent verification of the extension.

## Materials

- [Live app](https://revisoagent.xyz) — Google sign-in for private research.
- [Recorded demo](https://youtu.be/tj8HOTQ-atc) — fresh NVIDIA research journey.
- [GitHub repository](https://github.com/Ololadestephen/Reviso).
- [Guide](https://revisoagent.xyz/guide) and [written example](https://revisoagent.xyz/example).
- [Latest release verification](evaluations/2026-10-07-groq-release.md).
- [Official submission form](https://forms.gle/GyWZCMCPocgJdJon6).

## Before submitting

- [x] Signed code release pushed and deployed after an integrity-checked SQLite backup.
- [x] Public pages, protected API access, and account/data preservation checked.
- [x] User confirmed an existing signed-in research record still opens.
- [x] User completed the demo and provided its YouTube link.
- [ ] Confirm the video is viewable while signed out; playback is not verified here.
- [ ] Publish an X post with `#BitgetHackathon` and `@Bitget_AI`, quoting
      [the official post](https://x.com/Bitget_AI/status/2100519318824055159).
- [ ] Include the X post URL in its separate form field.
- [ ] Complete the description and LLM-role fields in the form itself.
- [ ] Submit and retain the confirmation. No form submission is claimed here.

See the [official handbook](https://bitget-ai.gitbook.io/bitgetai_hackathons2)
for field requirements. External links do not replace the project description.
University, Demo Day, and K3 subsidy fields are optional; select only what applies.
Do not include credentials, private notebook exports, or database backups.

## Project description draft

Reviso helps individual stock researchers record what would change their mind
about an idea. Research is often scattered across notes and chat messages;
Reviso keeps the idea, confirmed conditions, dated evidence, and human decision
in one versioned notebook.

Users choose one of six supported companies, explain their idea, review
conditions, check a company report, ask follow-up questions, and record whether
to keep, change, or set aside the idea. Official company sources provide
evidence; Bitget supplies separate market context. Numerical comparisons use
Decimal arithmetic, and missing evidence stays missing.

The live app includes Google-isolated libraries, source links, saved chat,
immutable versions, and Markdown/JSON/PDF exports. The recorded NVIDIA journey
compares 75% gross margin with a 75% minimum and 106% revenue growth with an 80%
minimum. Both conditions are supported for that quarter; the user keeps the
idea with the reason “It meets my expectation.” This is a demonstration, not a
buy recommendation or proof of future performance.

The October 7 release passed 274 backend and 126 frontend tests plus static
checks and a production build. Bounded AI checks include both successes and
failures, documented in [evaluation](EVALUATION.md). They do not establish
general research accuracy. The user study and independent research pilot remain
incomplete; no participant metrics or trading returns are claimed. Next steps
are independent source validation and broader newcomer/cross-browser testing.

## LLM role

Bitget Qwen 3.8 Max structures ideas and explains saved evidence, with Groq
Qwen selected when the Bitget key is absent. Groq `openai/gpt-oss-20b` drafts
editable conditions; Groq `qwen/qwen3.8-27b` answers cited follow-up questions.
Gemini has an optional, locally tested explanation adapter but is not active
for normal AWS traffic.

The sponsored Qwen credit was used for extraction and review. Early calibration
exposed response-contract failures; a subsequent constructed five-case validation
passed. The later supplemental-source check exposed a citation issue, followed
by a fix and a passing bounded regression. Qwen is useful for structuring and
explaining research, but timeouts and output validation remain practical limits.
AI does not confirm the user's conditions, compute the numerical finding,
record decisions, or execute trades.
