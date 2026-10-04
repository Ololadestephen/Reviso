// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AssumptionLedger from "../src/AssumptionLedger";
import ReplayPanel from "../src/ReplayPanel";
import ResearchOptions from "../src/features/journey/ResearchOptions";
import ResultExplanation from "../src/features/journey/ResultExplanation";
import {
  newestSource,
  reportDate,
  resultCounts,
  resultHeading,
  resultMode,
} from "../src/lib/resultPresentation";
import type { Assessment, History, ThesisRecord } from "../src/api/schemas";
import { defaultThesis, manualStarter } from "../src/domain/defaults";
import {
  idlePending,
  jsonResponse,
  makeAssessment,
  makeEvidence,
  makeInstrument,
  makeLlmStatus,
  makeRecord,
} from "./factories";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function historyFor(latest: Assessment, versions = [makeRecord()]): History {
  return {
    versions,
    events: [],
    assessments: [latest],
    selected_assessment: latest,
  };
}

function comparedResult(overrides: Partial<Assessment> = {}) {
  return makeAssessment({
    state: "INVALIDATED",
    evidence: [makeEvidence()],
    assumptions: [
      {
        assumption_id: "margin",
        state: "INVALIDATED",
        explanation: "Reported margin is below the confirmed minimum.",
        evidence_ids: ["source-1"],
        essential: true,
      },
    ],
    ...overrides,
  });
}

function renderLedger(latest: Assessment, versions?: ThesisRecord[]) {
  const onSource = vi.fn();
  const result = render(
    <AssumptionLedger
      latest={latest}
      history={historyFor(latest, versions)}
      thesis={defaultThesis}
      setSource={onSource}
    />,
  );
  return { ...result, onSource };
}

test("a comparison and its cited source are visible without opening condition details", () => {
  const latest = comparedResult();
  const { container, onSource } = renderLedger(latest);
  expect(screen.getByText("74.6%")).toBeTruthy();
  expect(screen.getByText("75%")).toBeTruthy();
  expect(screen.getByText("Did not hold")).toBeTruthy();
  expect(container.querySelector("details")?.open).toBe(false);
  fireEvent.click(
    screen.getByRole("button", { name: "View source for Gross margin" }),
  );
  expect(onSource).toHaveBeenCalledWith(latest.evidence[0]);
});

test.each(["0", "74.600000000000000001"])(
  "reported decimal %s is displayed without recalculation",
  (value) => {
    renderLedger(
      comparedResult({
        evidence: [makeEvidence({ metrics: { gaap_margin_pct: value } })],
      }),
    );
    expect(screen.getByText(`${value}%`)).toBeTruthy();
  },
);

test("absent numbers are not turned into zero", () => {
  renderLedger(
    comparedResult({
      evidence: [makeEvidence({ metrics: {} })],
      state: "INSUFFICIENT_EVIDENCE",
    }),
  );
  expect(screen.getByText("Not reported")).toBeTruthy();
  expect(screen.queryByText("0%")).toBeNull();
});

test("an uncited older number is not promoted into the current comparison", () => {
  renderLedger(
    comparedResult({
      assumptions: [
        {
          assumption_id: "margin",
          state: "INSUFFICIENT_EVIDENCE",
          explanation: "The report is too old.",
          evidence_ids: [],
          essential: true,
        },
      ],
    }),
  );
  expect(screen.getByText("No current number")).toBeTruthy();
  expect(screen.queryByText("74.6%")).toBeNull();
  expect(screen.queryByRole("button", { name: /View source/ })).toBeNull();
});

test("manual conditions remain human review, not numerical floors", () => {
  const manual = {
    ...manualStarter(),
    id: "demand",
    claim: "Advertising demand stays healthy.",
  };
  const record = makeRecord({
    thesis: { ...defaultThesis, assumptions: [manual] },
  });
  renderLedger(
    comparedResult({
      assumptions: [
        {
          assumption_id: "demand",
          state: "INSUFFICIENT_EVIDENCE",
          explanation: "Requires manual research.",
          evidence_ids: [],
          essential: true,
        },
      ],
    }),
    [record],
  );
  expect(
    within(
      document.querySelector(".comparison-condition") as HTMLElement,
    ).getByText(manual.claim),
  ).toBeTruthy();
  expect(screen.getByText("Needs your review")).toBeTruthy();
  expect(screen.getAllByText("—")).toHaveLength(2);
  expect(screen.queryByText("0%")).toBeNull();
});

test("a saved check shows its confirmed version's minimum, not a later edit", () => {
  const later = makeRecord({
    version: 3,
    thesis: {
      ...defaultThesis,
      assumptions: defaultThesis.assumptions.map((item) => ({
        ...item,
        minimum: "60",
      })),
    },
  });
  renderLedger(comparedResult(), [later, makeRecord()]);
  expect(screen.getByText("75%")).toBeTruthy();
  expect(screen.queryByText("60%")).toBeNull();
});

test("saved states are authoritative and optional gaps do not imply all conditions passed", () => {
  const latest = comparedResult({
    state: "SUPPORTED",
    assumptions: [
      {
        assumption_id: "margin",
        state: "SUPPORTED",
        explanation: "Saved result.",
        evidence_ids: ["source-1"],
        essential: true,
      },
      {
        assumption_id: "growth",
        state: "INSUFFICIENT_EVIDENCE",
        explanation: "Optional evidence is missing.",
        evidence_ids: [],
        essential: false,
      },
    ],
  });
  renderLedger(latest);
  expect(screen.getByText("Supported")).toBeTruthy();
  expect(screen.queryByText("Did not hold")).toBeNull();
  expect(screen.getByText("Optional condition")).toBeTruthy();
  expect(resultHeading(latest)).toBe("Required conditions are supported");
  expect(resultCounts(latest)).toEqual(["1 supported", "1 needs evidence"]);
});

test("an inactive saved result does not pretend an explanation is being generated", () => {
  const review = vi.fn();
  render(
    <ReplayPanel
      writing={false}
      pending={idlePending}
      active={false}
      refresh={vi.fn()}
      latest={comparedResult()}
      reviewWithAI={review}
      llmStatus={makeLlmStatus({ configured: true })}
      instrument={makeInstrument()}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "One condition did not hold" }),
  ).toBeTruthy();
  expect(screen.queryByText(/Writing a short explanation/)).toBeNull();
  expect(review).not.toHaveBeenCalled();
});

test("report selection uses publication time and dates use UTC", () => {
  const older = makeEvidence({ published_at: "2026-10-04T01:00:00+03:00" });
  const newer = makeEvidence({
    id: "newer",
    published_at: "2026-10-03T23:00:00Z",
  });
  expect(newestSource([older, newer])).toBe(newer);
  expect(reportDate(older.published_at)).toBe("3 Oct 2026");
  expect(newestSource([])).toBeUndefined();
});

test.each([
  ["HISTORICAL_REPLAY", "Historical example"],
  ["CONTROLLED_SCENARIO", "What-if check"],
  ["LIVE_REFRESH", "Company report"],
] as const)("%s is visibly distinguished", (mode, label) => {
  expect(resultMode(mode)).toBe(label);
  render(
    <ReplayPanel
      writing={false}
      pending={idlePending}
      active
      refresh={vi.fn()}
      latest={comparedResult({ mode })}
      reviewWithAI={vi.fn()}
      llmStatus={makeLlmStatus()}
      instrument={makeInstrument()}
    />,
  );
  expect(screen.getByText(label)).toBeTruthy();
});

test("a long explanation expands by keyboard and retains its additional citation", async () => {
  const summary =
    "The supplied company report supports one confirmed condition, while another still needs evidence. ".repeat(
      5,
    );
  const otherSource = makeEvidence({
    id: "source-2",
    title: "Additional report",
  });
  const latest = comparedResult({
    evidence: [makeEvidence(), otherSource],
    narrative_review: {
      summary,
      next_question: "What changed in demand?",
      items: [
        {
          assumption_id: "margin",
          stance: "SUPPORTS",
          explanation: "Cited evidence.",
          evidence_ids: ["source-2"],
        },
      ],
    },
  });
  const onSource = vi.fn();
  render(
    <ResultExplanation
      latest={latest}
      primarySourceId="source-1"
      onSource={onSource}
    />,
  );
  expect(
    document.querySelector(".reading-text")?.textContent?.length,
  ).toBeLessThanOrEqual(241);
  const user = userEvent.setup();
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Read more" }),
  );
  await user.keyboard("{Enter}");
  expect(
    screen
      .getByRole("button", { name: "Read less" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  expect(document.querySelector(".reading-text")?.textContent).toBe(summary);
  expect(screen.getByText(/Next question:/).parentElement).toHaveProperty(
    "textContent",
    "Next question: What changed in demand?",
  );
  await user.click(screen.getByRole("button", { name: otherSource.title }));
  expect(onSource).toHaveBeenCalledWith(otherSource);
  await user.click(screen.getByRole("button", { name: "Read less" }));
  expect(screen.queryByText(/Next question:/)).toBeNull();
});

test("Advanced view preserves metadata and limits, and market requests wait until Market details opens", async () => {
  const instrument = makeInstrument();
  const latest = comparedResult({
    missing: ["Compatible current share reference and unit ratio"],
    disclosure_retrieval: {
      availability: "UNAVAILABLE",
      checked_at: "2026-10-04T00:00:00Z",
      source: instrument.evidence_source,
      cached: false,
      warnings: ["Retrieval diagnostic"],
    },
    llm_provenance: {
      provider: "groq",
      model: "qwen/test-model",
      prompt_version: "evidence-review-v3",
      generated_at: "2026-10-04T00:00:00Z",
    },
  });
  const fetcher = vi.fn(async () =>
    jsonResponse({ detail: "unavailable" }, 503),
  );
  vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { container } = render(
    <QueryClientProvider client={client}>
      <ResearchOptions
        latest={latest}
        history={historyFor(latest)}
        instrument={instrument}
        record={makeRecord()}
        active
        writing={false}
        pending={{ stress: false, replayStep: null }}
        replay={vi.fn()}
        runStress={vi.fn()}
        onSource={vi.fn()}
        showDecision={false}
      />
    </QueryClientProvider>,
  );
  const advanced = container.querySelector("details")!;
  expect(advanced.open).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Advanced view"));
  await waitFor(() => expect(advanced.open).toBe(true));
  expect(fetcher).not.toHaveBeenCalled();
  const technical = screen
    .getByText("Check limits and technical details")
    .closest("details")!;
  fireEvent.click(
    within(technical).getByText("Check limits and technical details"),
  );
  expect(
    within(technical).getByText(/cannot compare this token price/),
  ).toBeTruthy();
  expect(within(technical).getByText(/qwen\/test-model/)).toBeTruthy();
  expect(within(technical).getByText("Retrieval diagnostic")).toBeTruthy();
  expect(screen.getByText("Previous checks").closest("details")?.open).toBe(
    false,
  );
  expect(screen.getByText("What-if tests").closest("details")?.open).toBe(
    false,
  );
  fireEvent.click(screen.getByText("Market details"));
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  expect(screen.getByText(/Market prices are separate/)).toBeTruthy();
  client.clear();
});
