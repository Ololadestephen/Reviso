# Newcomer journey specification

Implemented locally on September 12, 2026. This specification records the interaction now represented in the React workbench; it does not claim user-testing approval or production deployment.

## Journey

```text
Research library
  ├─ Start research ──> 1 Choose a stock
  │                       └─> 2 Explain the idea
  │                            └─> 3 Review assumptions
  │                                 └─> confirm immutable version
  │                                      └─> 4 Inspect evidence
  │                                           ├─> cited questions
  │                                           ├─> source details
  │                                           ├─> advanced scenario
  │                                           └─> 5 Record a decision
  │                                                ├─> keep
  │                                                ├─> revise
  │                                                └─> retire
  └─ Explore example ──> labeled editable NVIDIA example at step 2
```

The progress indicator on the create path is Choose → Explain → Review. After confirmation, the saved record uses the dashboard path Idea → Conditions → Evidence → Decision. The create progress control permits returning only to stages the visitor has reached. Selecting a different company clears incompatible unsaved fields. A saved thesis keeps its instrument identity; researching another company begins another thesis.

## Screen contract

| Stage | First thing a visitor sees | Primary outcome | Secondary content |
| --- | --- | --- | --- |
| Library | What Reviso helps them decide | Start research | Existing ideas and a labeled NVIDIA example |
| Choose | NVIDIA, Apple and Microsoft cards | Select one verified research target | Tokenized-exposure warning |
| Explain | Blank plain-language idea field and familiar risk labels | Continue manually or request an editable Qwen proposal | Slippage under Advanced |
| Review | Editable “what needs to stay true” cards | Save draft, then explicitly confirm | Position/risk confirmation summary |
| Evidence | Current saved result and official-source refresh | Understand what is supported, challenged or missing | Qwen narrative review, filing-bound chat, source drawer, Bitget then xStocks context, historical example and scenario controls |
| Decide | Current evidence state and reason field | Keep or retire | Revise instead; Markdown/JSON export |

Confirmation, revision and decision remain separate human actions. Qwen suggestions do not save, confirm or change a thesis. Numerical thresholds stay deterministic, and the stress test stays labeled as a controlled scenario.

## Recovery states

- Instrument catalog loading: show a status message; do not guess a stock list.
- Qwen unavailable: keep manual continuation active and explain that the evidence ledger remains usable.
- Qwen request failure: retain all entered text and surface the server's bounded error.
- Company evidence unavailable: keep the failure status, warnings, retry action and official-source route visible.
- Partial evidence: show which assumptions remain without a compatible metric.
- Stale evidence: retain the original dates and stale label.
- Failed refresh after an earlier success: keep the new unavailable assessment selected, and expose the earlier saved sources with their original assessment date and an explicit “not current” warning.
- Changed evidence context: reject a follow-up question with a conflict response and require reload; never answer against a client-supplied evidence bundle.
- Retired thesis: retain its timeline and exports while disabling research writes.

## Responsive layout

- Desktop: after confirmation, the saved record uses a two-column workspace: condition status on the left, Qwen explanation and decision controls on the right. Creating research stays a single-column guided flow.
- Tablet: cards and input groups collapse before labels become cramped; source details remain a modal drawer; the evidence conversation opens from a fixed control.
- Approximately 390px: company cards, progress stages, input pairs and action rows become single-column; horizontal content must not be required to finish.
- Every input has a visible text label. Keyboard focus is visible. Evidence and decision status use words in addition to color.

## Review still required

The implementation needs a local browser walkthrough at approximately 390px, 768px and desktop widths, including keyboard-only use and dialog focus restoration. The proposed three-person newcomer test remains unperformed; no participant outcomes are claimed.

