# Newcomer final local browser check — 2026-09-12

The rebuilt production frontend was served from loopback with both AI-provider variables explicitly absent and a disposable SQLite database. No Qwen request or production mutation was possible.

The first keyboard walkthrough exposed a hidden-field blocker: the collapsed maximum-slippage input started blank, so a newcomer could complete every visible field and still fail draft validation. The local fix gives that advanced field a 100-bps scenario default shown again in the confirmation summary, starts the manual assumption with an actually blank claim, explains the unconfigured-Qwen state and focuses the alert after validation errors. The frontend checks and production build passed before the journey was repeated.

Verified after the fix:

- Library → blank guided flow → Apple selection → idea and risk inputs → manual assumption → saved draft → explicit confirmation → public Apple SEC/Bitget refresh → human retain decision → deep-link reload → version-three Markdown/JSON export links.
- At 390px and 768px, all three stock choices remained visible and the document had no horizontal overflow. The default desktop layout had already loaded successfully.
- Keyboard activation worked for navigation, stock choice, stage progression, save, confirmation, refresh and decision controls.
- An empty manual claim produced an announced validation alert and moved focus to that alert.
- The native evidence dialog focused its close button when opened, closed with Escape and restored focus to the exact citation trigger.
- The local API log showed only expected public and persistence requests. Qwen actions remained disabled and the page clearly offered manual continuation.

The available test environment exposed one Chromium-based in-app browser. Safari and Firefox were not available, so a multi-engine browser matrix and the proposed three-person newcomer study remain unperformed. This is task-completion and accessibility evidence, not a formal WCAG certification or user-research result.
