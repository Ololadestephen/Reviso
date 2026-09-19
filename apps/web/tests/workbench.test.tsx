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
import EvidenceChatDock from "../src/features/journey/EvidenceChatDock";
import DecisionPanel from "../src/features/journey/DecisionPanel";
import JourneyProgress from "../src/features/journey/JourneyProgress";
import XStocksContextPanel from "../src/features/journey/XStocksContextPanel";
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
  fromThesisInput,
  manualStarter,
} from "../src/domain/defaults";
import {
  CHAT_BUBBLE_STORAGE_KEY,
  clampBubblePosition,
  defaultBubblePosition,
} from "../src/features/journey/chatBubblePosition";
import { accountFace } from "../src/lib/accountFace";
import {
  findingLabel,
  conditionStatusLabel,
  draftReady,
  followUpReady,
  humanGaps,
  ideaTitle,
  money,
  resultHeadline,
  resultTally,
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
  delete window.google;
});

const numerical = makeNumerical();

function authResponse(url: string) {
  if (url.includes("/auth/config")) {
    return jsonResponse({ mode: "local", google_client_id: null });
  }
  if (url.includes("/auth/me")) {
    return jsonResponse({
      user_id: "local",
      kind: "local",
      auth: "local",
      email: null,
      display_name: "Local researcher",
    });
  }
  return null;
}

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

test("a company that cannot test GAAP margin names that before confirm", () => {
  render(
    <ThesisEditor
      value={fromThesisInput(defaultThesis)}
      onChange={vi.fn()}
      locked={false}
      supportedMetrics={["revenue_growth_yoy_pct", "manual"]}
      companyName="Alphabet"
    />,
  );
  expect(screen.getByText("What Reviso can test for Alphabet")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toMatch(/GAAP gross margin/);
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
  expect(screen.queryByText("Latest Bitget observation")).toBeNull();
  expect(screen.queryByText("Unavailable")).toBeNull();
  expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
  expect(
    (screen.getByLabelText(/Maximum slippage used/) as HTMLInputElement).value,
  ).toBe("100");
  expect(manualStarter().claim).toBe("");
  expect(screen.queryByText("Try an example")).toBeNull();
});

test("the idea screen hides a missing Bitget quote instead of showing Unavailable", () => {
  render(
    <IdeaComposer
      value={{ ...emptyThesis(), instrument_id: "RNVDAUSDT" }}
      onChange={vi.fn()}
      locked={false}
      market={{
        instrument_id: "RNVDAUSDT",
        source: "Bitget public SDK",
        availability: "UNAVAILABLE",
        retrieved_at: "2026-09-14T06:01:00Z",
        observed_at: null,
        book_observed_at: null,
        last_price: null,
        bid: null,
        ask: null,
        warnings: ["Bitget ticker unavailable"],
        cached: false,
      }}
    />,
  );
  expect(screen.queryByText("Latest Bitget observation")).toBeNull();
  expect(screen.queryByText("Unavailable")).toBeNull();
  expect(screen.queryByRole("button", { name: "Use this price" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
});

test("the idea screen shows a Bitget observation without replacing the user's price", () => {
  const changed = vi.fn();
  const value = {
    ...emptyThesis(),
    instrument_id: "RNVDAUSDT" as const,
    entry_price: "200",
  };
  render(
    <IdeaComposer
      value={value}
      onChange={changed}
      locked={false}
      market={{
        instrument_id: "RNVDAUSDT",
        source: "Bitget public SDK",
        availability: "AVAILABLE",
        retrieved_at: "2026-09-14T06:01:00Z",
        observed_at: "2026-09-14T06:00:00Z",
        book_observed_at: null,
        last_price: "213.64",
        bid: null,
        ask: null,
        warnings: [],
        cached: false,
      }}
    />,
  );
  expect(screen.getByText("Bitget 213.64 USDT")).toBeTruthy();
  expect(
    (screen.getByLabelText(/Price you are considering/) as HTMLInputElement)
      .value,
  ).toBe("200");
  fireEvent.click(screen.getByRole("button", { name: "Use this price" }));
  expect(changed.mock.calls[0][0].entry_price).toBe("213.64");
  expect(screen.queryByText("Latest Bitget observation")).toBeNull();
  expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
});

test("xStocks is labelled as separate indicative context", () => {
  render(
    <XStocksContextPanel
      loading={false}
      context={{
        instrument_id: "RNVDAUSDT",
        xstock_symbol: "NVDAx",
        name: "NVIDIA xStock",
        underlying_symbol: "NVDA",
        currency: "USD",
        indicative_price: "213.755",
        availability: "AVAILABLE",
        retrieved_at: "2026-09-14T07:19:25Z",
        trading_halted: false,
        market_open: true,
        trading_period: "overnight",
        networks: ["Ethereum", "Solana"],
        source_url:
          "https://api.xstocks.fi/api/v2/public/assets/NVDAx/price-data",
        research_url: "https://xstocks.fi/us/news",
        cached: false,
        warnings: [],
        limitations: ["A different product."],
      }}
    />,
  );
  expect(screen.getByText("213.76 USD")).toBeTruthy();
  expect(screen.getByText(/not registered share ownership/i)).toBeTruthy();
  expect(screen.getByText(/another tokenized product/i)).toBeTruthy();
  expect(screen.getByText(/not the selected Bitget USDT quote/i)).toBeTruthy();
  expect(screen.getByText("A different product.")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /xStocks website/ }).getAttribute("href"),
  ).toBe("https://xstocks.fi/us/news");
});

test("the create path names three steps", () => {
  render(<JourneyProgress current={1} available={2} onNavigate={vi.fn()} />);
  expect(screen.getByRole("button", { name: /Choose/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Explain/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Review/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Evidence/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Decide/ })).toBeNull();
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
  expect(screen.getByText(/Writing a short explanation/)).toBeTruthy();
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
  expect(
    screen.getByText(
      "The passage is relevant but the deterministic floor still controls invalidation.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByText("Still missing: What will the next disclosure report?"),
  ).toBeTruthy();
  expect(screen.getByText("Technical details")).toBeTruthy();
  expect(screen.getByText(/qwen\/qwen3.8-27b/)).toBeTruthy();
  expect(screen.queryByText("What this evidence means")).toBeNull();
  expect(screen.queryByText(/does not invent a metric/)).toBeNull();
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
  const publicNavigation = screen.getByRole("navigation", {
    name: "Main navigation",
  });
  expect(publicNavigation.textContent).not.toContain("How it works");
  expect(publicNavigation.textContent).toContain("Guide");
  expect(publicNavigation.textContent).not.toContain("Example");
  expect(screen.queryByText("AI-ASSISTED STOCK RESEARCH")).toBeNull();
  expect(screen.queryByText("Know what would change your mind.")).toBeNull();
  expect(screen.getByText("No trade execution")).toBeTruthy();
  expect(screen.getByText("HOW IT WORKS")).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "From an idea to a clear decision." }),
  ).toBeTruthy();
  expect(screen.getByText("Company, conditions, decision.")).toBeTruthy();
  expect(landing.container.querySelector("#how-it-works")).toBeTruthy();
  expect(landing.container.querySelectorAll(".landing-step")).toHaveLength(3);
  expect(screen.getByText("Pick a company")).toBeTruthy();
  expect(screen.getByText("Write your idea")).toBeTruthy();
  expect(screen.getByText("Check and decide")).toBeTruthy();
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
  expect(screen.queryByText("Try the example")).toBeNull();
  expect(screen.queryByText("One condition, one dated print.")).toBeNull();
  expect(landing.container.querySelector(".cited-example-card")).toBeNull();
  const startResearch = screen.getByRole("link", { name: "Start my research" });
  expect(startResearch.getAttribute("href")).toBe("/app");
  expect(startResearch.className).toContain("hero-primary");
  expect(screen.queryByText("You confirm. Reviso does not trade.")).toBeNull();
  expect(screen.queryByText(/ask Qwen for help/i)).toBeNull();
  expect(screen.getByText(/Get help writing your idea/)).toBeTruthy();
  expect(
    screen.getByText(
      /Reviso is a research tool. It cannot place trades or make decisions/,
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/ugly print/i)).toBeNull();
  expect(screen.queryByText(/the invalidation was never/i)).toBeNull();
  expect(
    screen.getByText("Write the condition before the print."),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Read the NVIDIA example" })
      .getAttribute("href"),
  ).toBe("/example");
  expect(
    screen.queryByText(
      /Missing numbers stay missing. Qwen does not compute the comparison/,
    ),
  ).toBeNull();
  expect(screen.getByText(/The result is mixed/)).toBeTruthy();
  expect(screen.getByText(/Margin 74.6% is below 75%/)).toBeTruthy();
  expect(
    screen.getByRole("img", {
      name: /Q3 margin below 75% did not hold/,
    }),
  ).toBeTruthy();
  expect(screen.queryByText("Customer demand remains broad")).toBeNull();
  expect(screen.queryByText("Data-centre demand can remain strong")).toBeNull();
  expect(screen.queryByText("Invalidated")).toBeNull();
  expect(
    screen.getAllByRole("link", { name: "NVIDIA example" }).length,
  ).toBeGreaterThan(0);
  expect(
    screen
      .getAllByRole("link", { name: "NVIDIA example" })[0]
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
  expect(
    screen.getByRole("heading", {
      name: "One NVIDIA idea, two dated filings, and a human decision.",
    }),
  ).toBeTruthy();
  expect(screen.getByText(/does not fetch a live filing/i)).toBeTruthy();
  expect(
    screen.getByRole("heading", {
      name: "Second filing: the result is mixed",
    }),
  ).toBeTruthy();
  expect(
    screen.getByText("Margin: 74.6% is below 75% — invalidated."),
  ).toBeTruthy();
  expect(
    screen.getByText("Growth: 94% is still at least 80% — supported."),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", {
      name: "What Qwen may add, and what it may not",
    }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", {
      name: /fiscal 2025 third-quarter release/i,
    }),
  ).toBeTruthy();
  expect(example.container.querySelector(".landing-step")).toBeNull();
  expect(example.container.querySelector(".cited-example-card")).toBeNull();
  expect(example.container.querySelector(".product-preview")).toBeNull();
  expect(screen.queryByText("Read the Reviso guide")).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Continue with Google" })
      .getAttribute("href"),
  ).toBe("/app");
  expect(fetcher).not.toHaveBeenCalled();

  example.unmount();
  const guide = render(
    <MemoryRouter initialEntries={["/guide"]}>
      <App />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", {
      name: "Use evidence to test a stock idea before you act.",
    }),
  ).toBeTruthy();
  expect(screen.getByText("What Reviso is for")).toBeTruthy();
  expect(screen.getByText("What you actually do")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "How it works" })).toBeTruthy();
  expect(screen.getByText("Pick a company")).toBeTruthy();
  expect(screen.getByText("Write your idea")).toBeTruthy();
  expect(screen.getByText("Check and decide")).toBeTruthy();
  expect(
    screen.getByText(
      /From an idea to a clear decision: company, conditions, then the choice/,
    ),
  ).toBeTruthy();
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
  expect(screen.getByText("What counts as evidence")).toBeTruthy();
  expect(screen.getByText("What Qwen does")).toBeTruthy();
  expect(
    screen.getByText(
      /Missing numbers stay missing. Reviso does not invent a metric/,
    ),
  ).toBeTruthy();
  expect(screen.getByText("What is saved")).toBeTruthy();
  expect(guide.container.querySelector(".landing-step")).toBeTruthy();
  expect(guide.container.querySelector(".steps-grid")).toBeTruthy();
  expect(guide.container.querySelectorAll(".landing-step")).toHaveLength(3);
  expect(guide.container.querySelector(".cited-example-card")).toBeNull();
  expect(screen.queryByText("Read the complete NVIDIA example")).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Open the research app" })
      .getAttribute("href"),
  ).toBe("/app");
  expect(fetcher).not.toHaveBeenCalled();
});

test("the research app is a workbench instead of a second landing page", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      const authed = authResponse(url);
      if (authed) return authed;
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
  expect(
    await screen.findByRole("heading", { name: "Your research" }),
  ).toBeTruthy();
  const nav = screen.getByRole("navigation", { name: "App sections" });
  expect(screen.queryByText("Know what would change your mind.")).toBeNull();
  expect(screen.queryByText("Your theses")).toBeNull();
  expect(screen.queryByText("PROTECTED DEMO")).toBeNull();
  expect(screen.queryByText("RESEARCH APP")).toBeNull();
  expect(nav.textContent).toContain("My research");
  expect(nav.textContent).toContain("New research");
  expect(nav.textContent).not.toContain("Decision history");
  expect(screen.queryByRole("link", { name: "Guide" })).toBeNull();
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

test("unsigned visitors see Google sign-in instead of another person's library", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes("/auth/config")) {
        return jsonResponse({
          mode: "google",
          google_client_id: "test-google-client.apps.googleusercontent.com",
        });
      }
      if (url.includes("/auth/me")) {
        return jsonResponse({ detail: "Sign in to open your research" }, 401);
      }
      if (url.includes("/theses")) {
        return jsonResponse([makeThesisSummary()]);
      }
      return jsonResponse({ detail: "missing" }, 404);
    }),
  );
  renderApp("/app");
  expect(
    await screen.findByRole("heading", { name: "Continue with Google" }),
  ).toBeTruthy();
  expect(screen.queryByText("View the NVIDIA example")).toBeNull();
  expect(screen.queryByText("Data-centre demand can remain strong")).toBeNull();
});

test("Google sign-in opens the research library without a page reload", async () => {
  const user = {
    user_id: "google-user-1",
    kind: "person",
    auth: "google",
    email: "ada@example.test",
    display_name: "Ada",
  };
  let googleCallback: ((response: { credential: string }) => void) | undefined;
  window.google = {
    accounts: {
      id: {
        initialize: (config) => {
          googleCallback = config.callback;
        },
        renderButton: (parent) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = "Google test sign-in";
          button.addEventListener("click", () => {
            googleCallback?.({
              credential: `credential-good-${"x".repeat(20)}`,
            });
          });
          parent.appendChild(button);
        },
      },
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = init?.method ?? "GET";
      if (url.includes("/auth/config")) {
        return jsonResponse({
          mode: "google",
          google_client_id: "test-google-client.apps.googleusercontent.com",
        });
      }
      if (url.includes("/auth/google") && method === "POST") {
        return jsonResponse(user);
      }
      if (url.includes("/auth/me")) {
        return jsonResponse({ detail: "Sign in to open your research" }, 401);
      }
      if (url.includes("/theses")) {
        return jsonResponse([]);
      }
      if (url.includes("/instruments")) {
        return jsonResponse([makeInstrument()]);
      }
      if (url.includes("/llm/status")) {
        return jsonResponse(makeLlmStatus());
      }
      return jsonResponse({ detail: "missing" }, 404);
    }),
  );
  renderApp("/app");
  fireEvent.click(
    await screen.findByRole("button", { name: "Google test sign-in" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Your research" }),
  ).toBeTruthy();
  expect(await screen.findByText(/No saved research yet/)).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Continue with Google" }),
  ).toBeNull();
});

test("signing out clears the previous account from the app", async () => {
  let signedIn = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes("/auth/config")) {
        return jsonResponse({
          mode: "google",
          google_client_id: "test-google-client.apps.googleusercontent.com",
        });
      }
      if (url.includes("/auth/logout")) {
        signedIn = false;
        return jsonResponse({ ok: true });
      }
      if (url.includes("/auth/me")) {
        if (!signedIn) {
          return jsonResponse({ detail: "Sign in to open your research" }, 401);
        }
        return jsonResponse({
          user_id: "user-a",
          kind: "person",
          auth: "google",
          email: "ada@example.test",
          display_name: "Ada",
        });
      }
      if (url.includes("/instruments")) {
        return jsonResponse([makeInstrument()]);
      }
      if (url.includes("/llm/status")) {
        return jsonResponse(makeLlmStatus());
      }
      if (url.includes("/theses")) {
        return jsonResponse(signedIn ? [makeThesisSummary()] : []);
      }
      return jsonResponse({ detail: "missing" }, 404);
    }),
  );
  renderApp("/app");
  expect(
    await screen.findByRole("link", {
      name: "Data-centre demand can remain strong",
    }),
  ).toBeTruthy();
  fireEvent.click(screen.getAllByText("Ada")[0]);
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(
    await screen.findByRole("heading", { name: "Continue with Google" }),
  ).toBeTruthy();
  expect(screen.queryByText("Data-centre demand can remain strong")).toBeNull();
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
  fireEvent.click(screen.getByRole("button", { name: "Retry filing" }));
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
      const authed = authResponse(url);
      if (authed) return authed;
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

test("a failed follow-up question stays visible", async () => {
  const source = makeEvidence();
  const hash = "a".repeat(64);
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
        return jsonResponse(
          {
            detail:
              "Today's Qwen allowance for this account is used. Saved findings stay available; continue manually.",
          },
          429,
        );
      }
      if (url.includes("/conversation")) {
        return jsonResponse(makeConversation({ messages: [] }));
      }
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
        onSource={vi.fn()}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Why this result?" }),
  );
  expect((await screen.findByRole("alert")).textContent).toMatch(
    /Today's Qwen allowance/,
  );
});

test("follow-up chat uses Groq readiness, not Bitget extraction status", () => {
  expect(followUpReady({ configured: true })).toBe(true);
  expect(followUpReady({ configured: true, chat_configured: false })).toBe(
    false,
  );
  expect(followUpReady({ configured: false, chat_configured: true })).toBe(
    true,
  );
});

test("condition drafts use Groq readiness, not Bitget extraction status", () => {
  expect(draftReady({ configured: true })).toBe(true);
  expect(draftReady({ configured: true, draft_configured: false })).toBe(false);
  expect(draftReady({ configured: false, draft_configured: true })).toBe(true);
});

test("follow-up chat stays off when Groq is not connected", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes("/conversation")) {
        return jsonResponse(makeConversation({ messages: [] }));
      }
      return jsonResponse({ detail: "missing" }, 404);
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <EvidenceChat
        latest={makeAssessment({ evidence: [makeEvidence()] })}
        record={makeRecord()}
        llmStatus={makeLlmStatus({ configured: true, chat_configured: false })}
        onSource={vi.fn()}
      />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByText(/Follow-up chat is off on this app/),
  ).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (
      screen.getByRole("button", {
        name: "Why this result?",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

test("the same account keeps the same illustrated face card", () => {
  expect(accountFace("user-a")).toBe(accountFace("user-a"));
  expect(accountFace("user-a")).not.toBe(accountFace("user-b"));
  expect(accountFace("user-a")).toMatch(/^data:image\/svg\+xml/);
});

test("evidence result labels stay in plain language", () => {
  expect(findingLabel("SUPPORTED")).toBe("Supported");
  expect(findingLabel("CHALLENGED")).toBe("Needs attention");
  expect(findingLabel("INVALIDATED")).toBe("Did not hold");
  expect(findingLabel("INSUFFICIENT_EVIDENCE")).toBe("Not enough evidence");
  expect(conditionStatusLabel("SUPPORTED")).toBe("Supported");
  expect(conditionStatusLabel("CHALLENGED")).toBe("Challenged");
  expect(conditionStatusLabel("INSUFFICIENT_EVIDENCE")).toBe("Missing");
  expect(resultHeadline("CHALLENGED")).toBe("This filing needs a closer look");
  expect(
    resultTally("CHALLENGED", [
      { state: "SUPPORTED" },
      { state: "INSUFFICIENT_EVIDENCE" },
    ]),
  ).toBe("1 condition supported · 1 needs more evidence");
  expect(resultTally("SUPPORTED", [])).toBe("This filing supports your idea");
  expect(resultTally("INVALIDATED", [{ state: "INVALIDATED" }])).toBe(
    "1 did not hold",
  );
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
  const { container } = render(
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
    screen.getByRole("heading", {
      name: "1 condition supported · 1 needs more evidence",
    }),
  ).toBeTruthy();
  expect(screen.getByText("Previous checks")).toBeTruthy();
  expect(screen.getByText("Market details")).toBeTruthy();
  expect(
    (
      screen
        .getByText("Previous checks")
        .closest("details") as HTMLDetailsElement
    ).open,
  ).toBe(false);
  expect(
    (
      screen
        .getByText("Market details")
        .closest("details") as HTMLDetailsElement
    ).open,
  ).toBe(false);
  expect(
    screen.getByText("Customer concentration is not in this filing"),
  ).toBeTruthy();
  expect(screen.getAllByText("Supported").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Challenged").length).toBeGreaterThan(0);
  expect(screen.queryByText("Needs attention")).toBeNull();
  expect(screen.queryByText("1 filing checked")).toBeNull();
  expect(screen.getByRole("heading", { name: "Your conditions" })).toBeTruthy();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Quarterly company release" })[0],
  );
  expect(openDetails).toHaveBeenCalledWith(source);
  fireEvent.click(
    screen
      .getByText("Reported GAAP gross margin stays at or above 75%.")
      .closest("summary")!,
  );
  expect(
    screen.getByText("Reported GAAP gross margin: 74.6%. Floor: 75%."),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Record your decision" }),
  ).toBeTruthy();
  expect(container.querySelector(".dashboard-aside")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Ask about this filing" }),
  );
  expect(
    screen.getByRole("heading", { name: "Ask about this filing" }),
  ).toBeTruthy();
  expect(screen.getByText("Advanced checks")).toBeTruthy();
});

test("recording a decision keeps the result explanation visible", () => {
  const latest = makeAssessment({
    evidence: [makeEvidence({ title: "Quarterly company release" })],
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
  });
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
        onOpenSourceDetails={vi.fn()}
        onChangeConditions={vi.fn()}
        onRecordDecision={vi.fn()}
        showDecision
        decision={<p>Decision form</p>}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByText("Decision form")).toBeTruthy();
  expect(document.querySelector(".research-dashboard")?.className).toContain(
    "decision-focus",
  );
  expect(
    document.querySelector(".dashboard-aside")?.firstElementChild?.textContent,
  ).toContain("Decision form");
  expect(
    screen.getByText("The filing still matches the confirmed conditions."),
  ).toBeTruthy();
  expect(screen.queryByText("Reading of this filing")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Record your decision" }),
  ).toBeNull();
});

test("saved research can be downloaded as a versioned PDF", async () => {
  const record = makeRecord({ version: 3 });
  const assessment = makeAssessment({ thesis_version: 3 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      const authed = authResponse(url);
      if (authed) return authed;
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
    await screen.findByRole("navigation", { name: "Research path" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Record your decision" }));
  fireEvent.click(screen.getByText("Download this version"));
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
  expect(screen.getByText("Writing a short explanation…")).toBeTruthy();
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
  expect(screen.getByText(/Explanation unavailable/)).toBeTruthy();
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
      const authed = authResponse(url);
      if (authed) return authed;
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
    await screen.findByRole("navigation", { name: "Research path" }),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Check latest NVIDIA filing" }),
  );
  expect(
    await screen.findByText(
      "The filing still matches the confirmed conditions.",
    ),
  ).toBeTruthy();
  expect(calls.some((item) => item.includes("/refresh"))).toBe(true);
  expect(calls.some((item) => item.includes("/ai-review"))).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Ask Qwen to explain the evidence" }),
  ).toBeNull();
});

test("the decision card does not repeat the evidence result", () => {
  const latest = makeAssessment({
    assumptions: [
      {
        assumption_id: "margin",
        state: "INVALIDATED",
        explanation: "Reported margin is below 75%.",
        evidence_ids: ["source-1"],
        essential: true,
      },
    ],
  });
  const view = render(
    <DecisionPanel
      record={makeRecord()}
      latest={latest}
      active
      writing={false}
      pending={false}
      explanation=""
      onExplanation={vi.fn()}
      onKeep={vi.fn()}
      onSetAside={vi.fn()}
      onChangeConditions={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Keep, set aside, or change it" }),
  ).toBeTruthy();
  expect(screen.queryByText("Current evidence result")).toBeNull();
  expect(screen.getByText("Download this version")).toBeTruthy();
  expect(screen.getByText("Did not hold")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Keep idea" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (
      screen.getByRole("button", {
        name: "Change it instead",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  view.rerender(
    <DecisionPanel
      record={makeRecord()}
      latest={latest}
      active
      writing={false}
      pending={false}
      explanation="Growth still clears the floor I wrote."
      onExplanation={vi.fn()}
      onKeep={vi.fn()}
      onSetAside={vi.fn()}
      onChangeConditions={vi.fn()}
    />,
  );
  expect(
    (screen.getByRole("button", { name: "Keep idea" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  expect(
    (
      screen.getByRole("button", {
        name: "Change it instead",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});

test("the filing chat bubble can be dragged without opening", () => {
  const memory: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => memory[key] ?? null,
    setItem: (key: string, value: string) => {
      memory[key] = value;
    },
    removeItem: (key: string) => {
      delete memory[key];
    },
  });
  Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
  Object.defineProperty(window, "innerHeight", { value: 768, writable: true });
  const latest = makeAssessment({
    evidence: [makeEvidence({ title: "Quarterly company release" })],
  });
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
      <EvidenceChatDock
        latest={latest}
        record={makeRecord()}
        llmStatus={makeLlmStatus()}
        onSource={vi.fn()}
      />
    </QueryClientProvider>,
  );
  const bubble = screen.getByRole("button", { name: "Ask about this filing" });
  expect(defaultBubblePosition(1024, 768)).toEqual({ x: 952, y: 696 });
  fireEvent.pointerDown(bubble, {
    pointerId: 1,
    button: 0,
    clientX: 980,
    clientY: 720,
  });
  fireEvent.pointerMove(window, { pointerId: 1, clientX: 400, clientY: 400 });
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 400, clientY: 400 });
  fireEvent.click(bubble);
  expect(bubble.style.left).toBe("372px");
  expect(bubble.style.top).toBe("376px");
  expect(screen.queryByRole("heading", { name: "Ask about this filing" })).toBe(
    null,
  );
  expect(JSON.parse(memory[CHAT_BUBBLE_STORAGE_KEY] ?? "{}")).toEqual({
    x: 372,
    y: 376,
  });
});

test("bubble positions stay inside the window", () => {
  expect(clampBubblePosition({ x: -40, y: 900 }, 800, 600)).toEqual({
    x: 16,
    y: 528,
  });
});
