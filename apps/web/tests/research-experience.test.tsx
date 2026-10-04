// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import EvidenceChat from "../src/features/journey/EvidenceChat";
import SourceDrawer from "../src/SourceDrawer";
import ReplayPanel from "../src/ReplayPanel";
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

function chatProps(hash = "a".repeat(64)) {
  return {
    latest: makeAssessment({ input_hash: hash, evidence: [makeEvidence()] }),
    record: makeRecord(),
    llmStatus: makeLlmStatus({ configured: true }),
    onSource: vi.fn(),
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

test("chat names the newest included filing rather than the first source", async () => {
  const props = chatProps();
  props.latest.evidence = [
    makeEvidence({
      id: "older",
      title: "Older quarter",
      published_at: "2024-08-28T00:00:00Z",
    }),
    makeEvidence({
      id: "newer",
      title: "Newer quarter",
      published_at: "2024-11-20T00:00:00Z",
    }),
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse(makeConversation({ messages: [] }))),
  );
  render(<EvidenceChat {...props} />, { wrapper });
  expect(await screen.findByText(/Newer quarter.*Older example/)).toBeTruthy();
  expect(screen.queryByText(/Older quarter.*Older example/)).toBeNull();
});

test("chat displays saved facts, uncertainty, dates and clickable sources", async () => {
  const props = chatProps();
  const thread = makeConversation({
    messages: [
      {
        id: "answer",
        role: "assistant",
        kind: "followup",
        question: "Which condition did not hold?",
        text: "Margin fell below your limit.",
        answer: {
          summary: "Margin fell below your limit.",
          facts: [
            "Reported margin was 74.6%.",
            "Your confirmed minimum was 75%.",
          ],
          uncertainty: "Future margin remains unknown.",
          evidence_ids: ["source-1"],
        },
        evidence_ids: ["source-1"],
        created_at: "2026-10-04T09:00:00Z",
      },
    ],
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(thread))),
  );
  render(<EvidenceChat {...props} />, { wrapper });
  expect(await screen.findByText("Reported margin was 74.6%.")).toBeTruthy();
  expect(screen.getByText("Your confirmed minimum was 75%.")).toBeTruthy();
  expect(
    screen.getByText("Unknown: Future margin remains unknown."),
  ).toBeTruthy();
  expect(screen.getByText(/Older example/)).toBeTruthy();
  const sourceDate = new Date(props.latest.evidence[0].published_at)
    .getUTCFullYear()
    .toString();
  const link = screen.getByRole("button", {
    name: new RegExp(`Disclosure.*${sourceDate}`),
  });
  fireEvent.click(link);
  expect(props.onSource).toHaveBeenCalledWith(props.latest.evidence[0]);
});

test("Ctrl Enter sends once, locks the composer while pending, and plain Enter does not send", async () => {
  let resolveReply: ((reply: Response) => void) | undefined;
  const posts: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input, init) => {
      if (init?.method === "POST") {
        posts.push(init.body);
        return new Promise<Response>((resolve) => {
          resolveReply = resolve;
        });
      }
      return jsonResponse(makeConversation({ messages: [] }));
    }),
  );
  render(<EvidenceChat {...chatProps()} />, { wrapper });
  const field = screen.getByRole("textbox");
  fireEvent.change(field, {
    target: { value: "Which condition did not hold?" },
  });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(posts).toHaveLength(0);
  fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
  await waitFor(() => expect(posts).toHaveLength(1));
  expect((field as HTMLTextAreaElement).disabled).toBe(true);
  fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
  expect(posts).toHaveLength(1);
  resolveReply?.(jsonResponse(makeConversation({ messages: [] })));
  await waitFor(() =>
    expect((field as HTMLTextAreaElement).disabled).toBe(false),
  );
  expect((field as HTMLTextAreaElement).value).toBe("");
});

test("a stale conversation read pauses sending instead of spending credit", async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        jsonResponse({ detail: "The evidence context changed" }, 409),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  render(<EvidenceChat {...chatProps()} />, { wrapper });
  expect(await screen.findByText(/Reload this result/)).toBeTruthy();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Why this result?" }));
  expect(fetcher.mock.calls.every((call) => call[1]?.method !== "POST")).toBe(
    true,
  );
});

test("an older request's failure is not presented as an error for a new filing", async () => {
  let resolveReply: ((reply: Response) => void) | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input, init) => {
      if (init?.method === "POST")
        return new Promise<Response>((resolve) => {
          resolveReply = resolve;
        });
      return jsonResponse(makeConversation({ messages: [] }));
    }),
  );
  const view = render(<EvidenceChat {...chatProps()} />, { wrapper });
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Question about the old filing" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText(/Qwen is answering/);
  view.rerender(<EvidenceChat {...chatProps("c".repeat(64))} />);
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  resolveReply?.(jsonResponse({ detail: "Old request failed" }, 503));
  await waitFor(() =>
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(
      false,
    ),
  );
  expect(screen.queryByText("Old request failed")).toBeNull();
});

test("SEC filings identify their real publisher and verification details start folded", () => {
  const source = makeEvidence({
    origin: "PUBLIC_RETRIEVAL",
    publisher: "U.S. Securities and Exchange Commission",
    parser_version: "sec-test",
    document_hash: "document-hash",
  });
  const view = render(<SourceDrawer evidence={source} onClose={() => {}} />);
  expect(
    screen.getByText("U.S. Securities and Exchange Commission"),
  ).toBeTruthy();
  expect(screen.getByText("Retrieved from primary source")).toBeTruthy();
  expect(screen.queryByText("Retrieved from NVIDIA")).toBeNull();
  expect(view.container.querySelector("details")?.open).toBe(false);
  fireEvent.click(screen.getByText("Retrieval and verification details"));
  expect(screen.getByText("sec-test")).toBeTruthy();
  expect(screen.getByText("document-hash")).toBeTruthy();
});

test.each([false, true])(
  "the numerical result stays explained with AI configured=%s",
  (configured) => {
    render(
      <ReplayPanel
        writing={false}
        pending={idlePending}
        active={false}
        replay={() => {}}
        refresh={() => {}}
        reviewWithAI={() => {}}
        reviewFailed={configured}
        llmStatus={makeLlmStatus({ configured })}
        instrument={makeInstrument()}
        latest={makeAssessment({
          state: "INVALIDATED",
          evidence: [makeEvidence()],
          assumptions: [
            {
              assumption_id: "margin",
              state: "INVALIDATED",
              explanation: "Reported 74.6%; minimum 75%.",
              evidence_ids: ["source-1"],
              essential: true,
            },
          ],
        })}
      />,
    );
    expect(
      screen.getByText(
        /A condition you said would change your mind did not hold/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "1 did not hold" }),
    ).toBeTruthy();
  },
);
