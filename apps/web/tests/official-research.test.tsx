// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OfficialResearch from "../src/features/journey/OfficialResearch";
import ReplayPanel from "../src/ReplayPanel";
import ResultExplanation from "../src/features/journey/ResultExplanation";
import EvidenceChat from "../src/features/journey/EvidenceChat";
import { loadOfficialResearch } from "../src/api/endpoints";
import { researchSources } from "../src/lib/researchSources";
import {
  idlePending,
  jsonResponse,
  makeAssessment,
  makeConversation,
  makeEvidence,
  makeInstrument,
  makeLlmStatus,
  makeRecord,
} from "./factories";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function source() {
  return makeEvidence({
    id: "fed-1",
    kind: "MONETARY_POLICY",
    instrument_id: null,
    metrics: {},
    title: "FOMC policy statement",
    publisher: "Federal Reserve",
    published_at: "2026-09-16T18:00:00Z",
    origin: "PUBLIC_RETRIEVAL",
  });
}

function loadedCheck() {
  return makeAssessment({
    mode: "LIVE_REFRESH",
    research_sources: [source()],
    research_retrieval: [
      {
        provider: "SEC",
        availability: "UNAVAILABLE",
        checked_at: "2026-10-04T00:00:00Z",
        cached: false,
        warnings: ["Company report could not be reached"],
      },
      {
        provider: "FED",
        availability: "AVAILABLE",
        checked_at: "2026-10-04T00:00:00Z",
        cached: false,
        warnings: [],
      },
      {
        provider: "BLS",
        availability: "PARTIAL",
        checked_at: "2026-10-04T00:00:00Z",
        cached: false,
        warnings: ["Jobs release unavailable"],
      },
    ],
  });
}

function props(latest = makeAssessment({ mode: "LIVE_REFRESH" })) {
  return {
    latest,
    writing: false,
    pending: false,
    active: true,
    onLoad: vi.fn(),
    onSource: vi.fn(),
    onExplain: vi.fn(),
    aiReady: true,
    explaining: false,
  };
}

test("three options start collapsed and expanding does not fetch or spend", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const controls = props();
  const { container } = render(<OfficialResearch {...controls} />);
  expect(container.querySelector("details")?.open).toBe(false);
  await userEvent.setup().click(screen.getByText("More research"));
  expect(container.querySelector("details")?.open).toBe(true);
  expect(screen.getByText("Company report")).toBeTruthy();
  expect(screen.getByText("Fed policy")).toBeTruthy();
  expect(screen.getByText("Inflation and jobs")).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Load official research" }),
  );
  expect(controls.onLoad).toHaveBeenCalledOnce();
  expect(controls.onExplain).not.toHaveBeenCalled();
});

test.each(["HISTORICAL_REPLAY", "CONTROLLED_SCENARIO"])(
  "%s does not offer today's sources",
  (mode) => {
    render(<OfficialResearch {...props(makeAssessment({ mode }))} />);
    expect(
      screen.queryByRole("button", {
        name: "Load official research",
        hidden: true,
      }),
    ).toBeNull();
    expect(screen.getByText(/Today's releases are not added/)).toBeTruthy();
  },
);

test("partial sources stay readable, dated, clickable and separated from figures", async () => {
  const controls = props(loadedCheck());
  render(<OfficialResearch {...controls} />);
  await userEvent.setup().click(screen.getByText("More research"));
  expect(screen.getByText("Unavailable")).toBeTruthy();
  expect(screen.getByText("Partly loaded")).toBeTruthy();
  expect(screen.getByText("Loaded")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "FOMC policy statement" }),
  );
  expect(controls.onSource).toHaveBeenCalledWith(source());
  expect(screen.getByText(/Federal Reserve ·/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Explain with these sources" }),
  );
  expect(controls.onExplain).toHaveBeenCalledOnce();
});

test("source loading blocks duplicate clicks and retired records cannot refresh", async () => {
  render(<OfficialResearch {...props()} writing pending />);
  await userEvent.setup().click(screen.getByText("More research"));
  expect(
    (
      screen.getByRole("button", {
        name: "Loading official research…",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  cleanup();
  render(<OfficialResearch {...props(loadedCheck())} active={false} />);
  await userEvent.setup().click(screen.getByText("More research"));
  expect(
    (
      screen.getByRole("button", {
        name: "Refresh these sources",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

test("loading research does not trigger automatic paid explanations", () => {
  const review = vi.fn();
  render(
    <ReplayPanel
      writing={false}
      pending={idlePending}
      active
      refresh={vi.fn()}
      latest={loadedCheck()}
      reviewWithAI={review}
      llmStatus={makeLlmStatus({ configured: true })}
      instrument={makeInstrument()}
    />,
  );
  expect(review).not.toHaveBeenCalled();
});

test("saved explanation citations resolve supplemental sources without changing the filing set", async () => {
  const latest = loadedCheck();
  const financialCount = latest.evidence.length;
  latest.narrative_review = {
    summary: "The statement provides policy context, not company performance.",
    next_question: "What does the company report show?",
    items: [
      {
        assumption_id: "margin",
        stance: "INSUFFICIENT_EVIDENCE",
        explanation: "No company demand fact is established.",
        evidence_ids: ["fed-1"],
      },
    ],
  };
  const onSource = vi.fn();
  render(<ResultExplanation latest={latest} onSource={onSource} />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Read more" }));
  fireEvent.click(
    screen.getByRole("button", { name: "FOMC policy statement" }),
  );
  expect(onSource).toHaveBeenCalledWith(source());
  expect(latest.evidence).toHaveLength(financialCount);
  expect(researchSources(latest)).toHaveLength(financialCount + 1);
});

test("the request sends only the selected hash, not private idea text or external URLs", async () => {
  const fetcher = vi.fn(async () => jsonResponse(loadedCheck()));
  vi.stubGlobal("fetch", fetcher);
  const record = makeRecord();
  await loadOfficialResearch(record, "a".repeat(64));
  expect(fetcher).toHaveBeenCalledOnce();
  const [path, request] = fetcher.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  expect(path).toBe(`/api/theses/${record.id}/research-context`);
  expect(request.method).toBe("POST");
  expect(JSON.parse(request.body as string)).toEqual({
    assessment_input_hash: "a".repeat(64),
  });
});

test("chat can cite and open macro material even when company figures are missing", async () => {
  const latest = loadedCheck();
  latest.evidence = [];
  const thread = makeConversation();
  thread.messages[0].kind = "followup";
  thread.messages[0].evidence_ids = ["fed-1"];
  thread.messages[0].text =
    "Policy context cannot establish a company's condition.";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse(thread)),
  );
  const onSource = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <EvidenceChat
        latest={latest}
        record={makeRecord()}
        llmStatus={makeLlmStatus({ configured: true })}
        onSource={onSource}
      />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByText(
      "Policy context cannot establish a company's condition.",
    ),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: /FOMC policy statement/ }),
  );
  expect(onSource).toHaveBeenCalledWith(source());
  expect(
    screen.getByRole("heading", { name: "Ask about this research" }),
  ).toBeTruthy();
});
