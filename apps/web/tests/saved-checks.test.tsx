// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import PrintHistory from "../src/features/journey/PrintHistory";
import { dockStyle } from "../src/features/journey/chatBubblePosition";
import { historySchema } from "../src/api/schemas";
import { makeAssessment, makeEvidence } from "./factories";

afterEach(cleanup);

test("decisions attach only to their exact check, never inferred from versions", () => {
  const first = makeAssessment({ input_hash: "a".repeat(64) });
  const second = makeAssessment({ input_hash: "b".repeat(64) });
  const newer = makeAssessment({
    input_hash: "c".repeat(64),
    thesis_version: 3,
  });
  const history = historySchema.parse({
    versions: [],
    assessments: [first, second, newer],
    selected_assessment: newer,
    events: [
      {
        action: "retain",
        version: 3,
        at: "2026-09-19T12:00:00Z",
        explanation: "Exact decision",
        assessment_input_hash: second.input_hash,
      },
      {
        action: "retain",
        version: 4,
        at: "2026-09-19T13:00:00Z",
        explanation: "Legacy decision",
      },
    ],
  });
  render(<PrintHistory history={history} onSource={() => {}} />);
  const cards = screen.getAllByRole("article");
  expect(within(cards[0]).queryByText(/Decision:/)).toBeNull();
  expect(within(cards[1]).getByText("Decision: Exact decision")).toBeTruthy();
  expect(within(cards[2]).queryByText(/Decision:/)).toBeNull();
  expect(screen.queryByText(/Legacy decision/)).toBeNull();
});

test("missing evidence has no invented filing date while real sources keep theirs", () => {
  const history = historySchema.parse({
    versions: [],
    events: [],
    selected_assessment: null,
    assessments: [
      makeAssessment({ input_hash: "a".repeat(64), evidence: [] }),
      makeAssessment({
        input_hash: "b".repeat(64),
        evidence: [makeEvidence()],
      }),
    ],
  });
  render(<PrintHistory history={history} onSource={() => {}} />);
  const cards = screen.getAllByRole("article");
  expect(within(cards[0]).getByText(/No filing available/)).toBeTruthy();
  expect(within(cards[0]).queryByText(/Filing date/)).toBeNull();
  expect(within(cards[1]).getByText(/Filing date/)).toBeTruthy();
});

test.each([350, 450, 16, 728])(
  "chat stays inside an 800px viewport at y=%s",
  (y) => {
    const style = dockStyle({ x: 400, y }, 1000, 800);
    const top = style.top ?? 800 - style.bottom! - style.maxHeight;
    expect(top).toBeGreaterThanOrEqual(12);
    expect(top + style.maxHeight).toBeLessThanOrEqual(788);
    expect(style.maxHeight).toBeGreaterThan(0);
  },
);
