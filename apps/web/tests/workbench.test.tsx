// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../src/App";
import ThesisEditor from "../src/ThesisEditor";
import IdeaComposer from "../src/features/journey/IdeaComposer";
import ResearchQuestions from "../src/features/journey/ResearchQuestions";
import StockPicker from "../src/features/journey/StockPicker";
import ScenarioExplorer from "../src/ScenarioExplorer";
import Timeline from "../src/Timeline";
import ReplayPanel from "../src/ReplayPanel";
import AssumptionLedger from "../src/AssumptionLedger";
import SourceDrawer from "../src/SourceDrawer";
import { ApiError, ContractError } from "../src/api/client";
import { evidenceSchema } from "../src/api/schemas";
import { confirmDraft, fetchLlmStatus } from "../src/api/endpoints";
import {
  defaultThesis,
  emptyThesis,
  manualStarter,
} from "../src/domain/defaults";
import { ideaTitle, money } from "../src/lib/format";
import {
  idlePending,
  jsonResponse,
  makeAssessment,
  makeEvidence,
  makeInstrument,
  makeLlmStatus,
  makeNumerical,
  makeRecord,
  makeResearchAnswer,
  makeThesisSummary,
} from "./factories";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const numerical = makeNumerical();

function renderApp(path: string) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

test("library titles use the first sentence of an idea", () => {
  expect(
    ideaTitle(
      "Data-centre demand can remain strong. Extra context should stay off the list.",
    ),
  ).toBe("Data-centre demand can remain strong");
  expect(ideaTitle("")).toBe("Untitled idea");
  expect(
    ideaTitle(
      "A very long research idea without punctuation that would overflow a saved-research row if it were shown in full",
    ),
  ).toMatch(/…$/);
});

test("editing a floor keeps the confirmed condition consistent without mutating the saved input", () => {
  const changed = vi.fn();
  render(
    <ThesisEditor value={defaultThesis} onChange={changed} locked={false} />,
  );
  fireEvent.change(screen.getAllByRole("spinbutton")[0], {
    target: { value: "74" },
  });
  const proposed = changed.mock.calls[0][0];
  expect(proposed.assumptions[0].minimum).toBe("74");
  expect(proposed.assumptions[0].invalidation_condition).toBe(
    "Invalidate when reported GAAP gross margin is below 74%.",
  );
  expect(defaultThesis.assumptions[0].minimum).toBe("75");
});

test("confirmed thesis fields are locked", async () => {
  const changed = vi.fn();
  render(<ThesisEditor value={defaultThesis} onChange={changed} locked />);
  expect(
    screen.getAllByLabelText("What needs to stay true?")[0].closest("fieldset")
      ?.disabled,
  ).toBe(true);
  await userEvent
    .setup()
    .type(
      screen.getAllByLabelText("What needs to stay true?")[0],
      "Attempt to overwrite",
    );
  expect(changed).not.toHaveBeenCalled();
});

test("a newcomer can choose from the verified stock selection", () => {
  const select = vi.fn();
  render(
    <StockPicker
      loading={false}
      selected=""
      onSelect={select}
      instruments={[
        makeInstrument(),
        makeInstrument({
          id: "RAAPLUSDT",
          display_name: "Apple",
          ticker: "AAPL",
          base_coin: "rAAPL",
          provider_symbol: "RAAPLUSDT",
          historical_replay_available: false,
        }),
      ]}
    />,
  );
  expect(screen.getByText(/not registered shares in your name/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Apple/ }));
  expect(select).toHaveBeenCalledWith("RAAPLUSDT");
});

test("the idea screen starts blank and keeps execution controls advanced", () => {
  render(
    <IdeaComposer value={emptyThesis()} onChange={vi.fn()} locked={false} />,
  );
  expect(
    (screen.getByLabelText(/Explain your idea/) as HTMLTextAreaElement).value,
  ).toBe("");
  expect(screen.getByText("More options")).toBeTruthy();
  expect(screen.getByText(/research input, not an order/i)).toBeTruthy();
  expect(
    (screen.getByLabelText(/Maximum slippage used/) as HTMLInputElement).value,
  ).toBe("100");
  expect(manualStarter().claim).toBe("");
});

test("saved scenario controls match the assessment and running it reports the result", async () => {
  const run = vi.fn().mockResolvedValue(makeNumerical({ price_pnl: "-3000" }));
  render(
    <ScenarioExplorer
      disabled={false}
      pending={false}
      initial={numerical}
      scenario={makeAssessment().scenario}
      onRun={run}
    />,
  );
  expect(
    (screen.getByRole("slider", { name: /Price move/ }) as HTMLInputElement)
      .value,
  ).toBe("-20");
  expect(screen.getByText("-2,000.00")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Run stress test" }));
  await waitFor(() => expect(screen.getByText("-3,000.00")).toBeTruthy());
  expect(run.mock.calls[0][0].price_move_pct).toBe("-20");
});

test("a failed stress run leaves the previous result untouched", async () => {
  const run = vi.fn().mockRejectedValue(new Error("Thesis changed"));
  render(
    <ScenarioExplorer
      disabled={false}
      pending={false}
      initial={numerical}
      scenario={makeAssessment().scenario}
      onRun={run}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Run stress test" }));
  await waitFor(() => expect(run).toHaveBeenCalledOnce());
  expect(screen.getByText("-2,000.00")).toBeTruthy();
});

test("a rewind is labeled as an earlier cutoff, never as a recovery", () => {
  const later = makeAssessment({
    evidence_cutoff: "2024-11-21T00:00:00Z",
    state: "INVALIDATED",
    input_hash: "later",
  });
  const earlier = makeAssessment({
    evidence_cutoff: "2024-08-29T00:00:00Z",
    state: "SUPPORTED",
    input_hash: "earlier",
  });
  render(
    <Timeline
      history={{
        versions: [],
        events: [],
        assessments: [later, earlier],
        selected_assessment: earlier,
      }}
      onSource={vi.fn()}
    />,
  );
  expect(
    screen.getByText("Earlier replay cutoff: supported (not a recovery)"),
  ).toBeTruthy();
});

test("missing values are not formatted as zero", () => {
  expect(money(null)).toBe("Unavailable");
  expect(money("0")).toBe("0.00");
});

test("evidence saved before provenance tracking is readable and says so", () => {
  const { origin: _dropped, ...legacy } = makeEvidence();
  const parsed = evidenceSchema.parse(legacy);
  expect(parsed.origin).toBeUndefined();
  render(<SourceDrawer evidence={parsed} onClose={vi.fn()} />);
  // An unrecorded origin must not be presented as a curation claim.
  expect(screen.getByText("Retrieved · origin not recorded")).toBeTruthy();
  expect(screen.queryByText("Locally curated")).toBeNull();
});

test("API errors surface with their status and decimal strings stay strings", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(jsonResponse({ detail: "Version changed" }, 409));
  vi.stubGlobal("fetch", fetcher);
  const error = await confirmDraft(makeRecord(), {
    ...defaultThesis,
    proposed_amount: "10000.0000000001",
  }).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).message).toBe("Version changed");
  expect((error as ApiError).isConflict).toBe(true);
  expect(JSON.parse(fetcher.mock.calls[0][1].body).proposed_amount).toBe(
    "10000.0000000001",
  );
});

test("a response that breaks the contract is rejected instead of reaching the UI", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(jsonResponse({ provider: "groq", model: 42 })),
  );
  const error = await fetchLlmStatus().catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ContractError);
  expect((error as ContractError).message).toContain("/llm/status");
});

test("FastAPI field validation errors are reported per field", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      jsonResponse(
        {
          detail: [
            {
              loc: ["body", "max_loss"],
              msg: "Input should be greater than 0",
            },
          ],
        },
        422,
      ),
    ),
  );
  await expect(confirmDraft(makeRecord(), defaultThesis)).rejects.toThrow(
    "max_loss: Input should be greater than 0",
  );
});

test("Qwen evidence review is gated by server configuration and selected evidence", () => {
  const review = vi.fn().mockResolvedValue(undefined);
  const status = makeLlmStatus();
  const { rerender } = render(
    <ReplayPanel
      writing={false}
      pending={idlePending}
      active
      replay={vi.fn()}
      refresh={vi.fn()}
      latest={makeAssessment()}
      reviewWithAI={review}
      llmStatus={status}
      instrument={makeInstrument()}
    />,
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Ask Qwen to explain the evidence",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  rerender(
    <ReplayPanel
      writing={false}
      pending={idlePending}
      active
      replay={vi.fn()}
      refresh={vi.fn()}
      latest={makeAssessment({ evidence: [makeEvidence()] })}
      reviewWithAI={review}
      llmStatus={makeLlmStatus({ configured: true })}
      instrument={makeInstrument()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Ask Qwen to explain the evidence" }),
  );
  expect(review).toHaveBeenCalledOnce();
});

test("Qwen annotation is visibly separate from deterministic ledger state", () => {
  const result = makeAssessment({
    state: "INVALIDATED",
    narrative_review: {
      summary:
        "The passage is relevant but the deterministic floor still controls invalidation.",
      next_question: "What will the next disclosure report?",
      items: [
        {
          assumption_id: "margin",
          stance: "CONTRADICTS",
          explanation: "The cited passage reports a lower margin.",
          evidence_ids: ["source-1"],
        },
      ],
    },
    llm_provenance: {
      provider: "groq",
      model: "qwen/qwen3.8-27b",
      prompt_version: "evidence-review-v2",
      generated_at: "2026-09-10T00:00:00Z",
    },
  });
  render(
    <AssumptionLedger
      latest={result}
      history={{
        versions: [],
        events: [],
        assessments: [result],
        selected_assessment: result,
      }}
      setSource={vi.fn()}
    />,
  );
  expect(screen.getByText("Qwen’s explanation")).toBeTruthy();
  expect(screen.getByText("AI HELP · CHECK IT")).toBeTruthy();
  expect(screen.getByText(/does not change the evidence result/)).toBeTruthy();
});

test("public landing and example explain the product without calling an API", () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const landing = render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );

  expect(screen.getByText("Have a stock idea?")).toBeTruthy();
  expect(screen.queryByText("AI-ASSISTED STOCK RESEARCH")).toBeNull();
  expect(screen.queryByText("Know what would change your mind.")).toBeNull();
  expect(screen.getByText("No trade execution")).toBeTruthy();
  expect(screen.getByText("Company, conditions, decision.")).toBeTruthy();
  expect(screen.getByText("View filing")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "View filing" })).toBeNull();
  expect(screen.queryByText("Evidence coverage")).toBeNull();
  expect(
    screen.getByRole("img", {
      name: "Reviso screen for writing an NVIDIA research idea",
    }),
  ).toBeTruthy();
  expect(
    screen.getByRole("img", {
      name: "Reviso screen showing cited evidence and a recorded decision",
    }),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Start my research" })
      .getAttribute("href"),
  ).toBe("/app");
  expect(screen.queryByText(/ugly print/i)).toBeNull();
  expect(screen.queryByText(/the invalidation was never/i)).toBeNull();
  expect(
    screen.getByText("Write the condition before the print."),
  ).toBeTruthy();
  expect(screen.getByText("Invalidated")).toBeTruthy();
  expect(screen.getByText("74.6% in the third-quarter release")).toBeTruthy();
  expect(
    screen
      .getByRole("link", {
        name: /NVIDIA investor relations excerpt/,
      })
      .getAttribute("href"),
  ).toBe("/example");
  expect(
    screen
      .getByRole("link", { name: "Open the research app" })
      .getAttribute("href"),
  ).toBe("/app");
  expect(screen.queryByText("Ready to test your stock idea?")).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();

  landing.unmount();
  render(
    <MemoryRouter initialEntries={["/example"]}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByText(/read-only example/i)).toBeTruthy();
  expect(screen.getByText(/prepared walkthrough/i)).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
});

test("the research app is a workbench instead of a second landing page", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes("/instruments")) {
        return jsonResponse([makeInstrument()]);
      }
      if (url.includes("/llm/status")) {
        return jsonResponse(makeLlmStatus());
      }
      if (url.includes("/theses")) {
        return jsonResponse([makeThesisSummary()]);
      }
      return jsonResponse({ detail: "missing" }, 404);
    }),
  );

  const library = renderApp("/app");
  const nav = screen.getByRole("navigation", { name: "App sections" });
  expect(screen.getByRole("heading", { name: "Your research" })).toBeTruthy();
  expect(screen.queryByText("Know what would change your mind.")).toBeNull();
  expect(screen.queryByText("Your theses")).toBeNull();
  expect(screen.queryByText("PROTECTED DEMO")).toBeNull();
  expect(screen.queryByText("RESEARCH APP")).toBeNull();
  expect(nav.textContent).toContain("My research");
  expect(nav.textContent).toContain("New research");
  expect(nav.textContent).not.toContain("Decision history");
  expect(screen.getAllByRole("link", { name: "New research" })).toHaveLength(2);
  expect(
    await screen.findByRole("link", {
      name: "Data-centre demand can remain strong",
    }),
  ).toBeTruthy();
  expect(
    screen.queryByText(/Extra context should not appear in the list/),
  ).toBeNull();
  library.unmount();

  renderApp("/app/thesis/new");
  expect(
    await screen.findByRole("heading", {
      name: "Which company are you researching?",
    }),
  ).toBeTruthy();
  expect(screen.queryByText("Know what would change your mind.")).toBeNull();
  expect(screen.queryByText("STEP 1 OF 5")).toBeNull();
});

test("public disclosure failures remain visible while refresh stays available", () => {
  const refresh = vi.fn();
  render(
    <ReplayPanel
      writing={false}
      pending={idlePending}
      active
      replay={vi.fn()}
      refresh={refresh}
      reviewWithAI={vi.fn()}
      llmStatus={makeLlmStatus()}
      latest={makeAssessment({
        state: "INSUFFICIENT_EVIDENCE",
        mode: "LIVE_REFRESH",
        evidence_cutoff: "2026-09-11T00:00:00Z",
        disclosure_retrieval: {
          availability: "UNAVAILABLE",
          checked_at: "2026-09-11T00:00:00Z",
          source: "https://nvidianews.nvidia.com/news",
          cached: false,
          warnings: [
            "NVIDIA disclosure retrieval unavailable; no older report substituted.",
          ],
        },
      })}
      instrument={makeInstrument()}
    />,
  );
  expect(screen.getByRole("status").textContent).toContain("unavailable");
  expect(screen.getByText(/no older report substituted/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh NVIDIA evidence" }),
  );
  expect(refresh).toHaveBeenCalledOnce();
});

test("follow-up answers show only the current evidence context with clickable citations", () => {
  const source = makeEvidence();
  const openSource = vi.fn();
  render(
    <ResearchQuestions
      latest={makeAssessment({ evidence: [source] })}
      answers={[
        makeResearchAnswer(),
        makeResearchAnswer({
          id: "old-answer",
          assessment_input_hash: "older-assessment",
          input_hash: "older-question-hash",
        }),
      ]}
      pending={false}
      llmStatus={makeLlmStatus({ configured: true })}
      onAsk={vi.fn()}
      onSource={openSource}
    />,
  );
  expect(
    screen.getByText(/1 answer belong to an earlier evidence context/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Disclosure/ }));
  expect(openSource).toHaveBeenCalledWith(source);
});
