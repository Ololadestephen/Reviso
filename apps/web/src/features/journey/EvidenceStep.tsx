import { useEffect, useState, type ReactNode } from "react";
import AssumptionLedger from "../../AssumptionLedger";
import MarketPanel from "../../MarketPanel";
import ReplayPanel from "../../ReplayPanel";
import ScenarioExplorer from "../../ScenarioExplorer";
import EvidenceChatDock from "./EvidenceChatDock";
import QwenExplanation from "./QwenExplanation";
import SelectedSource from "./SelectedSource";
import XStocksContextPanel from "./XStocksContextPanel";
import { useXStocksContext } from "../../queries/workspace";
import type {
  Assessment,
  Evidence,
  History,
  Instrument,
  LLMStatus,
  Numerical,
  ThesisRecord,
} from "../../api/schemas";
import type { StressScenario } from "../../queries/workspace";
import { money } from "../../lib/format";

export default function EvidenceStep({
  writing,
  pending,
  active,
  replay,
  refresh,
  latest,
  reviewWithAI,
  reviewFailed = false,
  llmStatus,
  llmStatusUnavailable = false,
  instrument,
  history,
  runStress,
  record,
  lastEvidenceAssessment,
  onOpenSourceDetails,
  onChangeConditions,
  onRecordDecision,
  showDecision = false,
  decision = null,
}: {
  writing: boolean;
  pending: {
    refresh: boolean;
    review: boolean;
    replayStep: number | null;
    stress: boolean;
  };
  active: boolean;
  replay: (step: number) => void;
  refresh: () => void;
  latest: Assessment | null;
  reviewWithAI: () => void;
  reviewFailed?: boolean;
  llmStatus: LLMStatus;
  llmStatusUnavailable?: boolean;
  instrument: Instrument;
  history: History;
  runStress: (scenario: StressScenario) => Promise<Numerical>;
  record: ThesisRecord;
  lastEvidenceAssessment: Assessment | undefined;
  onOpenSourceDetails: (evidence: Evidence | null) => void;
  onChangeConditions: () => void;
  onRecordDecision: () => void;
  showDecision?: boolean;
  decision?: ReactNode;
}) {
  const xstocks = useXStocksContext(instrument.id);
  const [selected, setSelected] = useState<Evidence | null>(null);
  const currentIds = latest?.evidence.map((item) => item.id).join("|") ?? "";
  const priorIds =
    lastEvidenceAssessment?.evidence.map((item) => item.id).join("|") ?? "";

  useEffect(() => {
    setSelected((current) => {
      if (current && latest?.evidence.some((item) => item.id === current.id)) {
        return (
          latest.evidence.find((item) => item.id === current.id) ?? current
        );
      }
      if (
        current &&
        lastEvidenceAssessment?.evidence.some(
          (item) => item.id === current.id,
        ) &&
        !latest?.evidence.length
      ) {
        return (
          lastEvidenceAssessment.evidence.find(
            (item) => item.id === current.id,
          ) ?? current
        );
      }
      return latest?.evidence[0] ?? null;
    });
  }, [currentIds, priorIds, latest, lastEvidenceAssessment]);

  const current =
    !!selected && !!latest?.evidence.some((item) => item.id === selected.id);
  const unanswered =
    latest?.narrative_review?.next_question ?? latest?.next_question;
  const xstocksLive =
    xstocks.data?.availability === "AVAILABLE" &&
    xstocks.data.indicative_price != null;

  return (
    <div className="research-dashboard">
      <div className="dashboard-main">
        <ReplayPanel
          writing={writing}
          pending={pending}
          active={active}
          replay={replay}
          refresh={refresh}
          latest={latest}
          reviewWithAI={reviewWithAI}
          reviewFailed={reviewFailed}
          llmStatus={llmStatus}
          instrument={instrument}
          showExplanation={false}
          priorAssessment={
            latest && latest.evidence.length === 0
              ? (lastEvidenceAssessment ?? null)
              : null
          }
          onOpenSource={setSelected}
        />
        <AssumptionLedger
          latest={latest}
          history={history}
          setSource={setSelected}
          selectedId={selected?.id}
        />
        <div className="evidence-details-stack">
          <SelectedSource
            evidence={selected}
            current={current}
            onOpenDetails={onOpenSourceDetails}
          />
          <details className="panel market-context-details">
            <summary className="detail-summary">
              <span>
                <span className="eyebrow">MARKET CONTEXT</span>
                <strong>Bitget and xStocks</strong>
              </span>
              <small>
                {latest?.market?.last_price
                  ? `Saved Bitget ${money(latest.market.last_price)} USDT`
                  : "No saved Bitget quote"}
                {xstocksLive
                  ? ` · Live ${xstocks.data?.xstock_symbol} ${money(xstocks.data?.indicative_price)} USD (separate product)`
                  : ""}
              </small>
            </summary>
            <div className="detail-body market-context-body">
              <p>
                Bitget is the selected instrument. xStocks is a different
                product for the same company and cannot change this finding.
              </p>
              {latest?.market ? (
                <MarketPanel market={latest.market} instrument={instrument} />
              ) : (
                <p className="muted">
                  No saved Bitget observation yet. The record header shows a
                  live check when available.
                </p>
              )}
              <XStocksContextPanel
                context={xstocks.data ?? null}
                loading={xstocks.isLoading}
                embedded
              />
            </div>
          </details>
        </div>
        <details className="advanced-panel">
          <summary>Advanced checks</summary>
          <ScenarioExplorer
            key={`${record.id}-${record.version}-${latest?.input_hash}`}
            disabled={!active || writing}
            pending={pending.stress}
            initial={latest?.numerical ?? null}
            scenario={latest?.scenario}
            onRun={runStress}
          />
        </details>
      </div>
      <aside className="dashboard-aside">
        <section className="panel workspace-aside-card evidence-guidance">
          <QwenExplanation
            latest={latest}
            pendingReview={pending.review}
            reviewFailed={reviewFailed}
            llmStatus={llmStatus}
            statusUnavailable={llmStatusUnavailable}
            active={active}
            writing={writing}
            onRetry={reviewWithAI}
            embedded
          />
          {unanswered && !latest?.narrative_review && (
            <div className="open-question">
              <span className="eyebrow">STILL OPEN</span>
              <p>{unanswered}</p>
            </div>
          )}
          {!showDecision && (
            <div className="decision-prompt">
              <span className="eyebrow">YOUR NEXT STEP</span>
              <h2>Make the decision yours</h2>
              <p>
                Keep, change or set aside this idea after reading the result.
              </p>
              <div className="actions journey-actions">
                {active && (
                  <button type="button" onClick={onChangeConditions}>
                    Change conditions
                  </button>
                )}
                <button
                  type="button"
                  className="primary"
                  disabled={!latest}
                  onClick={onRecordDecision}
                >
                  Record my decision →
                </button>
              </div>
            </div>
          )}
        </section>
        {showDecision ? decision : null}
      </aside>
      {latest?.evidence.length ? (
        <EvidenceChatDock
          latest={latest}
          record={record}
          llmStatus={llmStatus}
          statusUnavailable={llmStatusUnavailable}
          onSource={setSelected}
        />
      ) : null}
    </div>
  );
}
