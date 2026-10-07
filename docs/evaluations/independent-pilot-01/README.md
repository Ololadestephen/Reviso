# Independent research pilot — preparation only

**Status: not selected, not frozen, not run. No AI requests are authorised.**

This pack prepares 24 slots across six companies. It does not contain 24
completed research cases or an accuracy result. The independent reviewer must
choose unfamiliar source material and write the expected answers. The developer
must not fill those answers and then call the exercise independent.

This is separate from the small user study, which remains the user's work.

## What is in this pack

- `slots.json`: six companies × four case types, all awaiting selection.
- `case-template.json`: the input, source and expected-answer fields to complete
  for each slot. Copy it into a new case file; never use its blank values as data.
- `run-plan.json`: proposed model routes, scoring rules and the credit ceiling.
  It is a proposal, not a frozen manifest or permission to spend.

The preparation baseline is Git commit
`9f93003361a9d6b48a9dcc576808c59b1a7eafde`. The accompanying reading-list changes
are not yet committed. Record the **actual final source hashes and commit** when
freezing, rather than claiming that this preparation baseline was evaluated.

## 1. Choose an independent reviewer

Choose someone who did not implement or tune Reviso's checking logic. Record
their role and any prior exposure to the reports/prompts. Ask them to choose the
documents/questions without looking at Reviso's answers. A second person checks
the expected values and resolves ambiguous interpretations before the freeze.
These are genuine people; an AI or another developer agent is not a substitute
for a claimed independent human review.

If no independent person is available, use this as a **developer-built
cross-company evaluation**, not an independent holdout. State that limitation.

## 2. Fill all 24 slots

Each company has four slots:

| Slot | What to select |
| --- | --- |
| Numerical support | An unfamiliar official report with a supported metric and a clearly met confirmed floor |
| Numerical contradiction | A suitable reported metric below the confirmed floor |
| Uncheckable | A genuinely missing, wrong-period or stale observation; rotate the reason across companies |
| Qualitative uncertainty | An idea such as customer demand or competitive strength that the supplied numbers cannot settle |

All six issuers support revenue-growth checks. Only NVIDIA, Apple, Microsoft and
Tesla support GAAP gross-margin checks. Never add unsupported margin coverage to
Alphabet or Amazon just to fill a slot. A manual condition's numerical state
remains insufficient evidence even if a reading offers relevant context.

Choose at least two distinct source periods per issuer (12 source packets
minimum). Do not reuse the two NVIDIA FY2025 Q2/Q3 replay reports, documents
already inspected in previous AI batches, or the current reports inspected during
development. Consult `docs/EVALUATION.md` and its linked batch manifests. Have the
reviewer record prior exposure honestly. Vary floors without asking the model to
invent them; the human fixes them before the run.

Use only existing allowlisted issuer sources. Preserve the original permitted
HTML/SEC JSON separately from expected extraction; do not replace source text with
a hand-picked correct metric. Record source URL, issuer/CIK, publication date,
period, retrieval time, SHA-256 and a local snapshot path. No live URL is fetched
by this pack, and arbitrary source URLs must not be added to the app.

Choose an explicit evidence cutoff for every case. Date-only reports become
available the next UTC day. A report older than 120 days cannot satisfy a current
metric; a future report cannot satisfy an earlier check. Current internet
retrieval time must not be silently substituted for the case's research date.

The independent expected answer needs:

- Exact metric, decimal-string value, period and source passage/location.
- Confirmed condition and minimum, expected per-condition state and overall state.
- Missing information, justified limits and claims the answer must not make.
- Acceptable explanation/citations, not an exact wording requirement.

Unsupported/injection/phantom-citation fixtures can supplement this pilot as
**synthetic robustness tests**. Report them separately, not as extra independent
real-report cases. xStocks links are not source packets for this company-evidence
pilot, and no unlicensed article text belongs in it.

## 3. Freeze before running

Keep expectations out of prompts/model input and away from the answer scorer
until raw outputs are saved. Before the first answer:

1. Complete every slot, resolve expected-answer disagreements, and record the
   independent selector and verifier. Record exclusions before any run.
2. Record the exact commit plus SHA-256 hashes of backend source, prompts, input
   cases, source snapshots, expectations, rubric and run configuration.
3. Choose one follow-up for each issuer in advance (six total); put the chosen
   case IDs in `run-plan.json`. Do not choose after seeing which reviews passed.
4. Set up a disposable SQLite database and isolated local identity. Never use the
   real notebook, production accounts, secrets in artifacts, or a live app's
   automatic review. Validate all case contracts offline first.
5. Implement and test a frozen runner that reads snapshots through the real
   parsers/checking logic, reserves a request before every attempt/repair, saves
   raw results, has no HTTP-status retries and refuses reruns. **This runner does
   not exist yet; the earlier three-action smoke script is not this benchmark.**
6. Get separate approval for the final frozen request cap. Then write the frozen
   manifest into a new run directory; never overwrite a previous run.

The proposed primary batch is 24 explanations and six follow-ups: 30 initial
requests, **at most 60 provider requests** including each action's one repair.
Timeouts and rejected responses consume attempts and remain in the denominator.
The baseline is off. A plain-Qwen comparison requires its own frozen fair inputs,
blind scoring and separately approved request budget. No drafts or extracts are
quietly included in this batch.

## 4. Score the result, not just the JSON

First run the offline parser/Decimal checks against independent expectations.
Then score the model's explanation and cited follow-ups separately:

| Measure | How to report it |
| --- | --- |
| Finding correctness | Exact extracted metric/period and expected condition/overall state; count correct out of all 24 |
| Citation support | Judge whether each material claim is supported by its cited passage, not merely whether its ID exists |
| Honest uncertainty | Did missing/manual evidence stay unresolved? Report fabricated values, citations and future facts individually |
| Useful explanation | Blind human rubric: 0 misleading, 1 partly clear, 2 clear/correct; explain disagreements |
| Follow-up quality | Six preselected questions, cited claims, remaining uncertainty and relevance to the user's conditions |
| Operational reliability | Raw contract passes, errors/timeouts, repairs, initial and total requests, provider-reported tokens |
| Speed/cost | Per-action times, median and p90 with sample count; dollar cost only if verified pricing/billing supports it |

Do not average away a fabricated citation or let a fluent explanation compensate
for an incorrect finding. Record mechanical rejection and factual quality as
different measures. Report company and case-type breakdowns, all failures and
all exclusions; no failures may disappear because the provider timed out.

Preserve raw results. A scorer correction gets a dated adjudication alongside the
original score, not a replacement. If code/prompts change, this set becomes a
regression set. A new untouched set is needed for a new independence claim.

Even a perfect 24-case pilot is not universal research accuracy, a trading return,
or evidence that any stock should be bought. Publish the actual denominators and
limits rather than a single impressive percentage.

## Next handoff

The remaining outside input is the independent selector/verifier. Once their
source packets and expected answers are complete, prepare the offline runner and
frozen manifest, then request approval for the capped AI batch. No scores or
independent review attestations have been filled in by the developer.
