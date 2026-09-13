import MarketPanel from "./MarketPanel";
import { llmProviderLabel } from "./lib/format";
import type { Assessment, Instrument, LLMStatus } from "./api/schemas";
export default function ReplayPanel({
  writing,
  pending,
  active,
  replay,
  refresh,
  latest,
  reviewWithAI,
  llmStatus,
  instrument,
}: {
  writing: boolean;
  pending: {
    refresh: boolean;
    review: boolean;
    replayStep: number | null;
  };
  active: boolean;
  replay: (step: number) => void;
  refresh: () => void;
  latest: Assessment | null;
  reviewWithAI: () => void;
  llmStatus: LLMStatus;
  instrument: Instrument;
}) {
  const loadLabel = (step: number) =>
    pending.replayStep === step ? "Loading…" : "Load";
  return (
    <section className="panel replay-panel">
      <span className="eyebrow">CHECK THE SOURCES</span>
      <h2>Check current company evidence</h2>
      <p>
        Refresh official quarterly evidence and a dated Bitget market
        observation for {instrument.display_name}. Missing evidence remains
        visible instead of being replaced.
      </p>
      {instrument.historical_replay_available && (
        <details className="historical-replay">
          <summary>Explore NVIDIA’s older evidence example</summary>
          <p>
            Each step exposes only documents available at that point. This is a
            company-disclosure replay, not a token-price backtest.
          </p>
          <div className="replay-step">
            <span>01</span>
            <div>
              <strong>August 29, 2024</strong>
              <p>Second-quarter disclosure available</p>
            </div>
            <button disabled={writing || !active} onClick={() => replay(0)}>
              {loadLabel(0)}
            </button>
          </div>
          <div className="replay-step">
            <span>02</span>
            <div>
              <strong>November 21, 2024</strong>
              <p>Third-quarter disclosure available</p>
            </div>
            <button disabled={writing || !active} onClick={() => replay(1)}>
              {loadLabel(1)}
            </button>
          </div>
          <p className="caption">
            Day-level gates · no implied intraday publication time.
          </p>
        </details>
      )}
      <button
        className="wide primary"
        disabled={writing || !active}
        onClick={refresh}
      >
        {pending.refresh
          ? "Checking official evidence…"
          : `Refresh ${instrument.display_name} evidence`}
      </button>
      {latest?.market && (
        <MarketPanel market={latest.market} instrument={instrument} />
      )}
      {latest?.disclosure_retrieval && (
        <div
          className={`retrieval-state ${latest.disclosure_retrieval.availability.toLowerCase()}`}
          role="status"
        >
          <strong>
            Company evidence ·{" "}
            {latest.disclosure_retrieval.availability
              .replaceAll("_", " ")
              .toLowerCase()}
          </strong>
          <p className="caption">
            Checked{" "}
            {new Date(latest.disclosure_retrieval.checked_at).toLocaleString()}
            {latest.disclosure_retrieval.cached ? " · cached result" : ""}
          </p>
          {latest.evidence.map((item) => (
            <p key={item.id}>
              <a href={item.source_url} target="_blank" rel="noreferrer">
                {item.title} ↗
              </a>
            </p>
          ))}
          {latest.disclosure_retrieval.warnings.map((warning) => (
            <p className="caption" key={warning}>
              {warning}
            </p>
          ))}
          {latest.disclosure_retrieval.availability !== "AVAILABLE" && (
            <p className="recovery-copy">
              You can retry, inspect the official source, or continue to record
              a decision that acknowledges the missing or dated evidence.
            </p>
          )}
        </div>
      )}
      <button
        className="wide ai-action"
        disabled={
          writing ||
          !active ||
          !llmStatus.configured ||
          !latest?.evidence.length
        }
        onClick={reviewWithAI}
      >
        {pending.review
          ? "Qwen is reading the saved evidence…"
          : "Ask Qwen to explain the evidence"}
      </button>
      <details>
        <summary>About AI use</summary>
        <p className="caption">
          {llmStatus.configured
            ? `${llmStatus.model} on ${llmProviderLabel(llmStatus.provider)} receives your confirmed conditions and selected source excerpts. Its explanation cannot change the evidence result.`
            : "AI help is unavailable in this environment. You can still read the sources and complete the process manually."}
        </p>
      </details>
      <p className="caption">
        Earlier checks stay in your decision history. Refreshing does not place
        a trade or change your confirmed conditions.
      </p>
    </section>
  );
}
