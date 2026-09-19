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
import { followUpReady } from "../../lib/format";

const suggestions = [
  "Why this result?",
  "What's missing?",
  "What should I check next?",
];

export default function EvidenceChat({
  latest,
  record,
  llmStatus,
  statusUnavailable = false,
  onSource,
  compact = false,
}: {
  latest: Assessment;
  record: ThesisRecord;
  llmStatus: LLMStatus;
  statusUnavailable?: boolean;
  onSource: (source: Evidence) => void;
  compact?: boolean;
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
    latest.evidence.length > 0,
  );
  const ask = useContinueConversation(record);
  const chatReady = followUpReady(llmStatus);
  const messages = (conversation.data?.messages ?? []).filter(
    (item) => item.kind !== "explanation",
  );
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
    const node = log.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, ask.isPending]);

  function send(text: string, detail = false) {
    const trimmed = text.trim();
    if (sending.current || ask.isPending || !chatReady || trimmed.length < 5) {
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
    <section
      className={`panel evidence-chat${compact ? " compact" : ""}`}
      aria-labelledby="evidence-chat-title"
    >
      <div className="drawer-head">
        <div>
          <span className="eyebrow">FOLLOW-UP</span>
          <h2 id="evidence-chat-title">Ask about this filing</h2>
        </div>
      </div>
      {newResult && (
        <p className="chat-banner" role="status">
          This conversation is about the new evidence result. Earlier answers
          stay saved with the previous filing.
        </p>
      )}
      <div className="chat-log" ref={log}>
        {messages.length === 0 && (
          <p className="chat-empty">
            Ask about the result, missing evidence, or what to check next.
          </p>
        )}
        {messages.map((item) => (
          <article className={`chat-turn ${item.role}`} key={item.id}>
            <div className="chat-turn-meta">
              <strong>{item.role === "assistant" ? "Qwen" : "You"}</strong>
              <time
                dateTime={item.created_at}
                title={new Date(item.created_at).toLocaleString()}
              >
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
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
        {ask.isError && (
          <p className="caption" role="alert">
            {ask.error instanceof Error
              ? ask.error.message
              : "Qwen could not answer from this filing. Try again."}
          </p>
        )}
      </div>
      {canAskMore && (
        <button
          type="button"
          className="text-action"
          disabled={ask.isPending || !chatReady}
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
            disabled={ask.isPending || !chatReady}
            onClick={() => send(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="chat-composer">
        <label>
          Your question
          <textarea
            ref={field}
            rows={compact ? 2 : 3}
            maxLength={500}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a follow-up about this result…"
          />
        </label>
        <button
          type="button"
          className="ai-action"
          disabled={ask.isPending || !chatReady || question.trim().length < 5}
          onClick={() => send(question)}
        >
          {ask.isPending ? "Sending…" : "Send"}
        </button>
      </div>
      {!chatReady && (
        <p className="caption">
          {statusUnavailable
            ? "Chat is paused because Reviso could not check the Qwen connection."
            : "Follow-up chat is off on this app. You can still read the filing."}
        </p>
      )}
      {conversation.isError && (
        <p className="caption" role="status">
          The evidence context changed. Reload this result to chat about the
          current filing.
        </p>
      )}
    </section>
  );
}
