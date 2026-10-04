import { useState } from "react";
import MarketPanel from "../../MarketPanel";
import ScenarioExplorer from "../../ScenarioExplorer";
import {
  humanGaps,
  isGeneralLimitation,
  llmProviderLabel,
} from "../../lib/format";
import { reportDate } from "../../lib/resultPresentation";
import {
  useXStocksContext,
  type StressScenario,
} from "../../queries/workspace";
import type {
  Assessment,
  Evidence,
  History,
  Instrument,
  Numerical,
  ThesisRecord,
} from "../../api/schemas";
import PrintHistory from "./PrintHistory";
import XStocksContextPanel from "./XStocksContextPanel";

const REPLAY_STEPS = [
  { step: 0, date: "29 August 2024", label: "Second-quarter report" },
  { step: 1, date: "21 November 2024", label: "Third-quarter report" },
];

function MarketContext({
  latest,
  instrument,
}: {
  latest: Assessment | null;
  instrument: Instrument;
}) {
  const xstocks = useXStocksContext(instrument.id);
  return (
    <div className="market-context-body">
      <p className="caption">
        Market prices are separate from the company evidence used in this
        result.
      </p>
      {latest?.market ? (
        <MarketPanel market={latest.market} instrument={instrument} />
      ) : (
        <p className="muted">No saved Bitget quote for this check.</p>
      )}
      <XStocksContextPanel
        context={xstocks.data ?? null}
        loading={xstocks.isLoading}
        embedded
      />
    </div>
  );
}

interface Props {
  latest: Assessment | null;
  history: History;
  instrument: Instrument;
  record: ThesisRecord;
  active: boolean;
  writing: boolean;
  pending: { stress: boolean; replayStep: number | null };
  replay: (step: number) => void;
  runStress: (scenario: StressScenario) => Promise<Numerical>;
  onSource: (source: Evidence) => void;
  showDecision: boolean;
}

export default function ResearchOptions({
  latest,
  history,
  instrument,
  record,
  active,
  writing,
  pending,
  replay,
  runStress,
  onSource,
  showDecision,
}: Props) {
  const [open, setOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const limits = humanGaps(latest?.missing ?? []).filter(isGeneralLimitation);
  return (
    <details
      className="panel research-options"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="detail-summary">
        <span>
          <strong>Advanced view</strong>
          <small>Market details, previous checks and what-if tests</small>
        </span>
      </summary>
      <div className="detail-body options-body">
        <details
          className="option-section"
          onToggle={(event) => setMarketOpen(event.currentTarget.open)}
        >
          <summary>Market details</summary>
          {open && marketOpen && (
            <MarketContext latest={latest} instrument={instrument} />
          )}
        </details>
        {!showDecision && (
          <PrintHistory history={history} onSource={onSource} />
        )}
        {!showDecision && instrument.historical_replay_available && (
          <details className="option-section historical-replay">
            <summary>Older NVIDIA example</summary>
            <p className="caption">
              Historical company reports, not a current check or token-price
              backtest.
            </p>
            {REPLAY_STEPS.map(({ step, date, label }) => (
              <div className="replay-step" key={step}>
                <div>
                  <strong>{date}</strong>
                  <p>{label}</p>
                </div>
                <button
                  disabled={writing || !active}
                  onClick={() => replay(step)}
                >
                  {pending.replayStep === step ? "Loading…" : "Load"}
                </button>
              </div>
            ))}
          </details>
        )}
        <details className="option-section">
          <summary>What-if tests</summary>
          <ScenarioExplorer
            key={`${record.id}-${record.version}-${latest?.input_hash}`}
            disabled={!active || writing}
            pending={pending.stress}
            initial={latest?.numerical ?? null}
            scenario={latest?.scenario}
            onRun={runStress}
          />
        </details>
        <details className="option-section">
          <summary>Check limits and technical details</summary>
          {limits.map((limit) => (
            <p key={limit}>{limit}</p>
          ))}
          {latest?.disclosure_retrieval && (
            <div>
              <p>
                Report retrieval:{" "}
                {latest.disclosure_retrieval.availability
                  .toLowerCase()
                  .replaceAll("_", " ")}
                {" · "}
                {reportDate(latest.disclosure_retrieval.checked_at)}
                {latest.disclosure_retrieval.cached ? " · cached" : ""}
              </p>
              {latest.disclosure_retrieval.warnings.map((warning) => (
                <p key={warning} className="caption">
                  {warning}
                </p>
              ))}
            </div>
          )}
          {latest?.llm_provenance && (
            <p>
              {llmProviderLabel(latest.llm_provenance.provider)} ·{" "}
              {latest.llm_provenance.model} ·{" "}
              {latest.llm_provenance.prompt_version}
            </p>
          )}
          {latest && (
            <p className="caption">
              Checked {reportDate(latest.evaluated_at)} · version{" "}
              {latest.thesis_version}
            </p>
          )}
          <p className="caption">
            Source hashes, parser details and full dates are available through
            each report’s source details.
          </p>
        </details>
      </div>
    </details>
  );
}
