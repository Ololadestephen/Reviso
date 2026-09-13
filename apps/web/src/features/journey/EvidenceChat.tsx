import { useEffect, useRef, useState } from "react";
import type {
  Assessment,
  Evidence,
  LLMStatus,
  ThesisRecord,
} from "../../api/schemas";
import {
  useContinueConversation,
  useConversation,
} from "../../queries/workspace";

const suggestions = [
  "Why this result?",
  "What should I check next?",
  "What does that mean?",
];

export default function EvidenceChat({
  open,
  latest,
  record,
  llmStatus,
  onClose,
  onSource,
}: {
  open: boolean;
  latest: Assessment;
  record: ThesisRecord;
  llmStatus: LLMStatus;
  onClose: () => void;
  onSource: (source: Evidence) => void;
}) {
  const [question, setQuestion] = useState("");
  const [newResult, setNewResult] = useState(false);
  const previousHash = useRef<string | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);
  const conversation = useConversation(
    record.id,
    latest.input_hash,
    open && latest.evidence.length > 0,
  );
  const ask = useContinueConversation(record);
  const messages = conversation.data?.messages ?? [];
  const lastAssistant = [...messages]
    .reverse()
    .find((item) => item.role === "assistant");
  const canAskMore =
    lastAssistant?.kind !== "detail" &&
    messages.some((item) => item.kind === "followup");

  useEffect(() => {
    if (
      previousHash.current &&
      previousHash.current !== latest.input_hash &&
      previousHash.current.length > 0
    ) {
      setNewResult(true);
    }
    previousHash.current = latest.input_hash;
  }, [latest.input_hash]);

  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const node = log.current;
    if (!open || !node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, ask.isPending, open]);

  function send(text: string, detail = false) {
    const trimmed = text.trim();
    if (
      sending.current ||
      ask.isPending ||
      !llmStatus.configured ||
      trimmed.length < 5
    ) {
      return;
    }
    sending.current = true;
    ask.mutate(
      {
        question: trimmed,
        assessmentInputHash: latest.input_hash,
        detail,
      },
      {
        onSettled: () => {
          sending.current = false;
        },
        onSuccess: () => setQuestion(""),
      },
    );
  }

  return (
    <>
      {open && (
        <button
          type="button"
          className="chat-backdrop"
          aria-label="Close chat"
          onClick={onClose}
        />
      )}
      <aside
        className={`evidence-chat-panel${open ? " open" : ""}`}
        aria-hidden={!open}
        aria-labelledby="evidence-chat-title"
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">CHAT ABOUT THIS RESULT</span>
            <h2 id="evidence-chat-title">Ask about the saved filing</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close chat">
            Close ×
          </button>
        </div>
        {newResult && (
          <p className="chat-banner" role="status">
            This conversation is about the new evidence result. Earlier answers
            stay saved with the previous filing.
          </p>
        )}
        <div className="chat-log" ref={log}>
          {messages.length === 0 && (
            <p className="muted">
              Suggested questions stay bound to this saved assessment. Qwen can
              explain the record; it cannot change the numerical result.
            </p>
          )}
          {messages.map((item) => (
            <article className={`chat-turn ${item.role}`} key={item.id}>
              <strong>
                {item.role === "assistant"
                  ? item.kind === "explanation"
                    ? "Explanation"
                    : "Qwen"
                  : "You"}
              </strong>
              <p>{item.text}</p>
              {item.answer?.uncertainty && item.role === "assistant" && (
                <p className="caption">Unknown: {item.answer.uncertainty}</p>
              )}
              {item.evidence_ids.length > 0 && (
                <div className="evidence-links">
                  {item.evidence_ids.map((id) => {
                    const source = latest.evidence.find(
                      (entry) => entry.id === id,
                    );
                    return source ? (
                      <button
                        type="button"
                        key={id}
                        onClick={() => onSource(source)}
                      >
                        ↗ {source.title}
                      </button>
                    ) : null;
                  })}
                </div>
              )}
            </article>
          ))}
          {ask.isPending && (
            <p className="caption" role="status">
              Qwen is answering from this filing…
            </p>
          )}
        </div>
        {canAskMore && (
          <button
            type="button"
            className="text-action"
            disabled={ask.isPending || !llmStatus.configured}
            onClick={() => send("Tell me more about that.", true)}
          >
            Tell me more
          </button>
        )}
        <div className="suggestion-row">
          {suggestions.map((item) => (
            <button
              type="button"
              key={item}
              disabled={ask.isPending || !llmStatus.configured}
              onClick={() => send(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label>
          Your question
          <textarea
            ref={field}
            rows={2}
            maxLength={500}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a follow-up about this result…"
          />
        </label>
        <button
          type="button"
          className="ai-action"
          disabled={
            ask.isPending || !llmStatus.configured || question.trim().length < 5
          }
          onClick={() => send(question)}
        >
          {ask.isPending ? "Sending…" : "Send"}
        </button>
        {!llmStatus.configured && (
          <p className="caption">
            Chat is off because Qwen is not connected. You can still read the
            filing.
          </p>
        )}
        {conversation.isError && (
          <p className="caption" role="status">
            The evidence context changed. Close this panel and open chat on the
            current result.
          </p>
        )}
      </aside>
    </>
  );
}
