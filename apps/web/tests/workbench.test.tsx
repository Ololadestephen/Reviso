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
import EvidenceStep from "../src/features/journey/EvidenceStep";
import EvidenceChat from "../src/features/journey/EvidenceChat";
import StockPicker from "../src/features/journey/StockPicker";
import ScenarioExplorer from "../src/ScenarioExplorer";
import Timeline from "../src/Timeline";
import ReplayPanel from "../src/ReplayPanel";
import SourceDrawer from "../src/SourceDrawer";
import { ApiError, ContractError } from "../src/api/client";
import { evidenceSchema } from "../src/api/schemas";
import { confirmDraft, fetchLlmStatus } from "../src/api/endpoints";
import {
  defaultThesis,
  emptyThesis,
  manualStarter,
} from "../src/domain/defaults";
import {
  findingLabel,
  humanGaps,
  ideaTitle,
  money,
  resultHeadline,
} from "../src/lib/format";
import {
  idlePending,
  jsonResponse,
  makeAssessment,
  makeEvidence,
  makeInstrument,
  makeConversation,
  makeLlmStatus,
  makeNumerical,
  makeRecord,
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
  expect(screen.queryByText("Try an example")).toBeNull();
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

test("Qwen evidence review starts from evidence without a second click", async () => {
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
    screen.queryByRole("button", { name: "Explain this result" }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Chat about this result" }),
  ).toBeNull();
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
  expect(
    screen.queryByRole("button", { name: "Explain this result" }),
  ).toBeNull();
  expect(screen.getByText(/without another click/)).toBeTruthy();
  await waitFor(() => expect(review).toHaveBeenCalledOnce());
});

test("Qwen annotation is visibly separate from deterministic ledger state", () => {
  const result = makeAssessment({
    state: "INVALIDATED",
    evidence: [makeEvidence()],
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
      prompt_version: "evidence-review-v3",
      generated_at: "2026-09-10T00:00:00Z",
    },
  });
  render(
    <ReplayPanel
      writing={false}
      pending={idlePending}
      active
      replay={vi.fn()}
      refresh={vi.fn()}
      latest={result}
      reviewWithAI={vi.fn()}
      llmStatus={makeLlmStatus({ configured: true })}
      instrument={makeInstrument()}
    />,
  );
  expect(screen.getByText("What this evidence means")).toBeTruthy();
  expect(screen.getByText(/does not change the evidence result/)).toBeTruthy();
  expect(
    screen.getByText("The cited passage reports a lower margin."),
  ).toBeTruthy();
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
  expect(screen.getByText("See if the evidence supports it.")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Open app" }).getAttribute("href"),
  ).toBe("/app");
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
  const example = render(
    <MemoryRouter initialEntries={["/example"]}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByText(/read-only example/i)).toBeTruthy();
  expect(screen.getByText(/prepared walkthrough/i)).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();

  example.unmount();
  render(
    <MemoryRouter initialEntries={["/guide"]}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByText("How a research session works.")).toBeTruthy();
  expect(screen.getByText("74.6% in the third-quarter release")).toBeTruthy();
  expect(
    screen.getByRole("img", {
      name: "Reviso screen for writing an NVIDIA research idea",
    }),
  ).toBeTruthy();
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
    screen.getByRole("button", { name: "Check latest NVIDIA filing" }),
  );
  expect(refresh).toHaveBeenCalledOnce();
});

test("the evidence result hides engine placeholders and explains when Qwen is off", () => {
  render(
    <ReplayPanel
      writing={false}
      pending={idlePending}
      active
      replay={vi.fn()}
      refresh={vi.fn()}
      reviewWithAI={vi.fn()}
      llmStatus={makeLlmStatus()}
      latest={makeAssessment({
        evidence: [makeEvidence()],
        missing: [
          "Compatible current share reference and unit ratio",
          "Narrative AI review has not been added to this assessment",
          "Token terms and current redemption availability",
        ],
      })}
      instrument={makeInstrument()}
    />,
  );
  expect(screen.getByText(/Qwen is not connected on this app/)).toBeTruthy();
  expect(screen.getByText(/cannot compare this token price/)).toBeTruthy();
});

test("follow-up answers show only the current evidence context with clickable citations", async () => {
  const source = makeEvidence();
  const openSource = vi.fn();
  const hash = "a".repeat(64);
  const thread = makeConversation();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method =
        init?.method ??
        (typeof input !== "string" && !(input instanceof URL)
          ? input.method
          : "GET");
      if (url.includes("/conversation") && method === "POST") {
        return jsonResponse({
          ...thread,
          messages: [
            ...thread.messages,
            {
              id: "user-1",
              role: "user",
              kind: "followup",
              text: "Why this result?",
              question: "Why this result?",
              answer: null,
              evidence_ids: [],
              created_at: "2026-09-10T00:00:01Z",
            },
            {
              id: "assistant-2",
              role: "assistant",
              kind: "followup",
              text: "The saved disclosure reports the selected metric.",
              question: "Why this result?",
              answer: {
                summary: "The saved disclosure reports the selected metric.",
                facts: [],
                uncertainty: "The next reporting period remains unknown.",
                evidence_ids: ["source-1"],
              },
              evidence_ids: ["source-1"],
              created_at: "2026-09-10T00:00:01Z",
            },
          ],
        });
      }
      if (url.includes("/conversation")) return jsonResponse(thread);
      return jsonResponse({ detail: "missing" }, 404);
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <EvidenceChat
        latest={makeAssessment({ evidence: [source], input_hash: hash })}
        record={makeRecord()}
        llmStatus={makeLlmStatus({ configured: true })}
        onSource={openSource}
      />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Why this result?")).toBeTruthy();
  expect(screen.getByText("What should I check next?")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Why this result?" }));
  fireEvent.click(await screen.findByRole("button", { name: /Disclosure/ }));
  expect(openSource).toHaveBeenCalledWith(source);
});

test("evidence result labels stay in plain language", () => {
  expect(findingLabel("SUPPORTED")).toBe("Supported");
  expect(findingLabel("CHALLENGED")).toBe("Needs attention");
  expect(findingLabel("INVALIDATED")).toBe("Did not hold");
  expect(findingLabel("INSUFFICIENT_EVIDENCE")).toBe("Not enough evidence");
  expect(resultHeadline("CHALLENGED")).toBe("This filing needs a closer look");
  expect(
    humanGaps([
      "Compatible current share reference and unit ratio",
      "Narrative AI review has not been added to this assessment",
      "Token terms and current redemption availability",
    ]),
  ).toEqual([
    "Reviso cannot compare this token price with the listed share price.",
    "Whether you can redeem the token for shares is not part of this check.",
  ]);
});

test("example sentences fill a blank idea and do not overwrite typed text without confirmation", () => {
  const changed = vi.fn();
  const nvidia = { ...emptyThesis(), instrument_id: "RNVDAUSDT" as const };
  const { rerender } = render(
    <IdeaComposer value={nvidia} onChange={changed} locked={false} />,
  );
  expect(screen.getByText("Try an example")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Data-centre demand stays strong" }),
  );
  expect(changed.mock.calls[0][0].rationale).toMatch(/data-centre demand/);

  changed.mockClear();
  rerender(
    <IdeaComposer
      value={{ ...nvidia, rationale: "My own words about NVIDIA demand." }}
      onChange={changed}
      locked={false}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Reported margin stays high" }),
  );
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByText(/would replace what you already wrote/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Keep what I wrote" }));
  expect(changed).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Reported margin stays high" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Replace with this example" }),
  );
  expect(changed.mock.calls[0][0].rationale).toMatch(/GAAP gross margin/);
});

test("idea examples stay specific to the selected company", () => {
  render(
    <IdeaComposer
      value={{ ...emptyThesis(), instrument_id: "RAAPLUSDT" }}
      onChange={vi.fn()}
      locked={false}
    />,
  );
  expect(
    screen.getByRole("button", { name: "The business keeps growing" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Data-centre demand stays strong" }),
  ).toBeNull();
});

test("evidence shows the result, findings and selected source before advanced controls", () => {
  const source = makeEvidence({ title: "Quarterly company release" });
  const latest = makeAssessment({
    state: "CHALLENGED",
    evidence: [source],
    missing: ["Customer concentration is not in this filing"],
    assumptions: [
      {
        assumption_id: "growth",
        state: "SUPPORTED",
        explanation: "Reported growth remains positive.",
        evidence_ids: ["source-1"],
        essential: true,
      },
      {
        assumption_id: "margin",
        state: "CHALLENGED",
        explanation: "Reported margin is below the chosen floor.",
        evidence_ids: ["source-1"],
        essential: true,
      },
    ],
  });
  const openDetails = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).includes("/conversation")) {
        return jsonResponse(makeConversation({ messages: [] }));
      }
      return jsonResponse({ detail: "missing" }, 404);
    }),
  );
  render(
    <QueryClientProvider client={client}>
      <EvidenceStep
        writing={false}
        pending={{
          refresh: false,
          review: false,
          replayStep: null,
          stress: false,
        }}
        active
        replay={vi.fn()}
        refresh={vi.fn()}
        latest={latest}
        reviewWithAI={vi.fn()}
        llmStatus={makeLlmStatus()}
        instrument={makeInstrument()}
        history={{
          versions: [makeRecord()],
          events: [],
          assessments: [latest],
          selected_assessment: latest,
        }}
        runStress={vi.fn()}
        record={makeRecord()}
        lastEvidenceAssessment={undefined}
        onOpenSourceDetails={openDetails}
        onChangeConditions={vi.fn()}
        onRecordDecision={vi.fn()}
      />
    </QueryClientProvider>,
  );
  expect(
    screen.getByRole("heading", { name: "This filing needs a closer look" }),
  ).toBeTruthy();
  expect(
    screen.getByText("Customer concentration is not in this filing"),
  ).toBeTruthy();
  expect(screen.getByText("Supported")).toBeTruthy();
  expect(screen.getAllByText("Needs attention").length).toBeGreaterThan(1);
  expect(
    screen.getByRole("heading", { name: "The report we checked" }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "View filing" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Record my decision →" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Ask about this filing" }),
  ).toBeTruthy();
  expect(screen.getByText("Advanced checks")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Source details" }));
  expect(openDetails).toHaveBeenCalledWith(source);
});

test("saved research can be downloaded as a versioned PDF", async () => {
  const record = makeRecord({ version: 3 });
  const assessment = makeAssessment({ thesis_version: 3 });
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
      if (url.includes("/questions")) {
        return jsonResponse([]);
      }
      if (url.includes("/assessments")) {
        return jsonResponse({
          versions: [record],
          assessments: [assessment],
          events: [],
          selected_assessment: assessment,
        });
      }
      if (url.includes(`/theses/${record.id}`)) {
        return jsonResponse(record);
      }
      return jsonResponse({ detail: "missing" }, 404);
    }),
  );

  renderApp(`/app/thesis/${record.id}`);
  expect(
    await screen.findByRole("heading", {
      name: "Does the evidence support your idea?",
    }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Record my decision →" }));
  expect(
    screen.getByRole("link", { name: "Download PDF" }).getAttribute("href"),
  ).toBe(`/api/theses/${record.id}/export?format=pdf&version=3`);
  expect(
    screen
      .getByRole("link", { name: "Download Markdown" })
      .getAttribute("href"),
  ).toBe(`/api/theses/${record.id}/export?format=markdown&version=3`);
  expect(
    screen.getByRole("link", { name: "Download JSON" }).getAttribute("href"),
  ).toBe(`/api/theses/${record.id}/export?format=json&version=3`);
});

test("the numerical result stays visible while Qwen explains", () => {
  render(
    <ReplayPanel
      writing
      pending={{ ...idlePending, review: true }}
      active
      replay={vi.fn()}
      refresh={vi.fn()}
      latest={makeAssessment({ evidence: [makeEvidence()] })}
      reviewWithAI={vi.fn()}
      llmStatus={makeLlmStatus({ configured: true })}
      instrument={makeInstrument()}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "This filing supports your idea" }),
  ).toBeTruthy();
  expect(screen.getByText("Qwen is writing a short explanation…")).toBeTruthy();
});

test("a failed explanation leaves the evidence result and offers retry", () => {
  const retry = vi.fn();
  render(
    <ReplayPanel
      writing={false}
      pending={idlePending}
      active
      replay={vi.fn()}
      refresh={vi.fn()}
      latest={makeAssessment({ evidence: [makeEvidence()] })}
      reviewWithAI={retry}
      reviewFailed
      llmStatus={makeLlmStatus({ configured: true })}
      instrument={makeInstrument()}
    />,
  );
  expect(screen.getByText("Explanation unavailable")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry explanation" }));
  expect(retry).toHaveBeenCalledOnce();
});

test("checking evidence shows the result first and requests an explanation without a second click", async () => {
  const record = makeRecord();
  const checked = makeAssessment({
    evidence: [makeEvidence()],
    input_hash: "c".repeat(64),
  });
  const explained = makeAssessment({
    ...checked,
    input_hash: "d".repeat(64),
    narrative_review: {
      summary: "The filing still matches the confirmed conditions.",
      next_question: "What will the next disclosure report?",
      items: [
        {
          assumption_id: "margin",
          stance: "SUPPORTS",
          explanation: "The cited passage reports the relevant metric.",
          evidence_ids: ["source-1"],
        },
      ],
    },
    llm_provenance: {
      provider: "bitget-qwen",
      model: "qwen3.8-max",
      prompt_version: "evidence-review-v3",
      generated_at: "2026-09-10T00:00:00Z",
      total_ms: 12,
      ttft_ms: null,
      repair_attempts: 0,
    },
  });
  let selected = null as ReturnType<typeof makeAssessment> | null;
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method =
        init?.method ??
        (typeof input !== "string" && !(input instanceof URL)
          ? input.method
          : "GET");
      calls.push(`${method} ${url}`);
      if (url.includes("/instruments")) {
        return jsonResponse([makeInstrument()]);
      }
      if (url.includes("/llm/status")) {
        return jsonResponse(
          makeLlmStatus({ configured: true, streaming: "untested" }),
        );
      }
      if (url.includes("/refresh")) {
        selected = checked;
        return jsonResponse(checked);
      }
      if (url.includes("/ai-review")) {
        selected = explained;
        return jsonResponse(explained);
      }
      if (url.includes("/assessments")) {
        return jsonResponse({
          versions: [record],
          assessments: selected ? [selected] : [],
          events: [],
          selected_assessment: selected,
        });
      }
      if (url.includes(`/theses/${record.id}`)) {
        return jsonResponse(record);
      }
      return jsonResponse({ detail: "missing" }, 404);
    }),
  );

  renderApp(`/app/thesis/${record.id}`);
  expect(
    await screen.findByRole("heading", {
      name: "Does the evidence support your idea?",
    }),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Check latest NVIDIA filing" }),
  );
  expect(await screen.findByText("What this evidence means")).toBeTruthy();
  expect(calls.some((item) => item.includes("/refresh"))).toBe(true);
  expect(calls.some((item) => item.includes("/ai-review"))).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Ask Qwen to explain the evidence" }),
  ).toBeNull();
});
