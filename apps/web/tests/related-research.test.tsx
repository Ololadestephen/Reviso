// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RelatedResearch from "../src/features/journey/RelatedResearch";
import { researchLinksFor } from "../src/features/journey/xstocksResearchLinks";
import { instrumentIdSchema } from "../src/api/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EvidenceStep from "../src/features/journey/EvidenceStep";
import {
  idlePending,
  makeAssessment,
  makeInstrument,
  makeLlmStatus,
  makeNumerical,
  makeRecord,
} from "./factories";

const cutoff = "2026-10-04T00:00:00Z";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test.each(instrumentIdSchema.options)(
  "%s gets only its company mentions or wider-market links, newest first",
  (instrumentId) => {
    const links = researchLinksFor(instrumentId, cutoff);
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(
      links.every(
        (link) => link.marketWide || link.companies.includes(instrumentId),
      ),
    ).toBe(true);
    const dates = links.map((link) => link.publishedOn);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
    for (const link of links) {
      const url = new URL(link.url);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("xstocks.fi");
      expect(url.pathname.startsWith("/news/")).toBe(true);
      expect(url.search).toBe("");
    }
  },
);

test("Tesla and Apple company-specific links do not leak to other companies", () => {
  expect(
    researchLinksFor("RTSLAUSDT", cutoff).some((link) =>
      link.label.includes("Tesla"),
    ),
  ).toBe(true);
  expect(
    researchLinksFor("RAAPLUSDT", cutoff).some((link) =>
      link.label.includes("Apple"),
    ),
  ).toBe(true);
  const other = researchLinksFor("RMSFTUSDT", cutoff);
  expect(other.every((link) => link.marketWide)).toBe(true);
  expect(other).toHaveLength(2);
});

test("date-only publication is gated until the next UTC day", () => {
  const before = researchLinksFor("RTSLAUSDT", "2026-09-29T23:59:59Z");
  const after = researchLinksFor("RTSLAUSDT", "2026-09-30T00:00:00Z");
  expect(before.some((link) => link.id === "2026-09-29-tesla")).toBe(false);
  expect(after[0].id).toBe("2026-09-29-tesla");
  expect(researchLinksFor("RTSLAUSDT", cutoff)[0].id).toBe(after[0].id);
});

test.each(["2024-11-21T00:00:00Z", "not a date"])(
  "an older or invalid cutoff %s shows no future reading",
  (evidenceCutoff) => {
    const { container } = render(
      <RelatedResearch
        instrument={makeInstrument()}
        evidenceCutoff={evidenceCutoff}
      />,
    );
    expect(container.childElementCount).toBe(0);
    expect(researchLinksFor("RNVDAUSDT", evidenceCutoff)).toEqual([]);
  },
);

test("reading is link-only, clearly separate, and does not fetch any provider", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const instrument = makeInstrument({ id: "RTSLAUSDT", display_name: "Tesla" });
  const { container } = render(
    <RelatedResearch instrument={instrument} evidenceCutoff={cutoff} />,
  );
  expect(screen.getByText(/not used in this result or chat/)).toBeTruthy();
  expect(screen.getByText("Mentions Tesla")).toBeTruthy();
  expect(screen.getByText(/Links checked 4 Oct 2026/)).toBeTruthy();
  const details = container.querySelector("details")!;
  expect(details.open).toBe(false);
  const summary = screen.getByText("More reading (1)");
  await userEvent.setup().click(summary);
  expect(details.open).toBe(true);
  for (const link of screen.getAllByRole("link")) {
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  }
  expect(fetcher).not.toHaveBeenCalled();
});

test("switching company or rewinding replaces the list without retaining another company", () => {
  const { rerender } = render(
    <RelatedResearch
      instrument={makeInstrument({ id: "RTSLAUSDT", display_name: "Tesla" })}
      evidenceCutoff={cutoff}
    />,
  );
  rerender(
    <RelatedResearch
      instrument={makeInstrument({ id: "RAAPLUSDT", display_name: "Apple" })}
      evidenceCutoff={cutoff}
    />,
  );
  expect(screen.queryByText("Mentions Tesla")).toBeNull();
  expect(screen.getByText("Mentions Apple")).toBeTruthy();
  rerender(
    <RelatedResearch
      instrument={makeInstrument()}
      evidenceCutoff="2024-08-29T00:00:00Z"
    />,
  );
  expect(screen.queryByRole("region", { name: "Related research" })).toBeNull();
});

test("the workspace shows reading outside Advanced view, without changing the result or calling AI", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const latest = makeAssessment({ evidence_cutoff: cutoff, evidence: [] });
  const record = makeRecord();
  const before = JSON.stringify(latest);
  const decide = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const props = {
    writing: false,
    pending: { ...idlePending, stress: false },
    active: true,
    replay: vi.fn(),
    refresh: vi.fn(),
    latest,
    reviewWithAI: vi.fn(),
    llmStatus: makeLlmStatus(),
    instrument: makeInstrument(),
    history: {
      versions: [record],
      events: [],
      assessments: [latest],
      selected_assessment: latest,
    },
    runStress: vi.fn(async () => makeNumerical()),
    record,
    lastEvidenceAssessment: undefined,
    onOpenSourceDetails: vi.fn(),
    onChangeConditions: vi.fn(),
    onRecordDecision: decide,
  };
  const { rerender } = render(
    <QueryClientProvider client={client}>
      <EvidenceStep {...props} />
    </QueryClientProvider>,
  );
  const reading = screen.getByRole("region", { name: "Related research" });
  expect(reading.closest("details")).toBeNull();
  expect(screen.getByText("Advanced view").closest("details")?.open).toBe(
    false,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Record your decision" }));
  expect(decide).toHaveBeenCalledOnce();
  expect(JSON.stringify(latest)).toBe(before);
  expect(props.reviewWithAI).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
  rerender(
    <QueryClientProvider client={client}>
      <EvidenceStep {...props} showDecision />
    </QueryClientProvider>,
  );
  expect(screen.queryByRole("region", { name: "Related research" })).toBeNull();
  client.clear();
});
