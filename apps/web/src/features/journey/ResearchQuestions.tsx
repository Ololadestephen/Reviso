import { useState } from "react";
import type {
  Assessment,
  Evidence,
  LLMStatus,
  SavedResearchAnswer,
} from "../../api/schemas";

const suggestions = [
  "Why did this condition change?",
  "Which evidence supports this result?",
  "What is still missing?",
];

export default function ResearchQuestions({
  latest,
  answers,
  pending,
  llmStatus,
  onAsk,
  onSource,
}: {
  latest: Assessment;
  answers: SavedResearchAnswer[];
  pending: boolean;
  llmStatus: LLMStatus;
  onAsk: (question: string) => void;
  onSource: (source: Evidence) => void;
}) {
  const [question, setQuestion] = useState("");
  const current = answers.filter(
    (item) => item.assessment_input_hash === latest.input_hash,
  );
  const older = answers.length - current.length;
  return (
    <section className="panel questions-panel">
      <span className="eyebrow">ASK ABOUT THIS RESEARCH</span>
      <h2>Understand the evidence</h2>
      <p className="muted">
        Answers are limited to this saved idea and its cited evidence. Qwen can
        explain the record but cannot change your conditions or decision.
      </p>
      <div className="suggestion-row">
        {suggestions.map((item) => (
          <button type="button" key={item} onClick={() => setQuestion(item)}>
            {item}
          </button>
        ))}
      </div>
      <label>
        Your question
        <textarea
          rows={2}
          maxLength={500}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about the findings, sources, or uncertainty…"
        />
      </label>
      <button
        type="button"
        className="ai-action"
        disabled={
          pending || !llmStatus.configured || question.trim().length < 5
        }
        onClick={() => onAsk(question.trim())}
      >
        {pending
          ? "Qwen is checking the saved evidence…"
          : "Ask with citations"}
      </button>
      {!llmStatus.configured && (
        <p className="caption">
          AI questions are unavailable; the cited ledger remains usable.
        </p>
      )}
      {older > 0 && (
        <p className="caption">
          {older} answer{older === 1 ? "" : "s"} belong to an earlier evidence
          context and are preserved in the export rather than shown as current.
        </p>
      )}
      {current.map((item) => (
        <article className="answer-card" key={item.id}>
          <strong>{item.question}</strong>
          <p>{item.answer.summary}</p>
          {item.answer.facts.length > 0 && (
            <ul>
              {item.answer.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          )}
          <p className="caption">Uncertainty: {item.answer.uncertainty}</p>
          <div className="evidence-links">
            {item.answer.evidence_ids.map((id) => {
              const source = latest.evidence.find((entry) => entry.id === id);
              return source ? (
                <button type="button" key={id} onClick={() => onSource(source)}>
                  ↗ {source.title}
                </button>
              ) : null;
            })}
          </div>
        </article>
      ))}
    </section>
  );
}
