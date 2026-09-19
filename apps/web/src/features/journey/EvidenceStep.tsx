import { useEffect, useState, type ReactNode } from "react";
import AssumptionLedger from "../../AssumptionLedger";
import MarketPanel from "../../MarketPanel";
import ReplayPanel from "../../ReplayPanel";
import ScenarioExplorer from "../../ScenarioExplorer";
import EvidenceChatDock from "./EvidenceChatDock";
import PrintHistory from "./PrintHistory";
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

  const xstocksLive =
    xstocks.data?.availability === "AVAILABLE" &&
    xstocks.data.indicative_price != null;

  function openSource(evidence: Evidence) {
    setSelected(evidence);
    onOpenSourceDetails(evidence);
  }

  return (
    <div
      className={`research-dashboard${showDecision ? " decision-focus" : " evidence-first"}`}
    >
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
          compact={showDecision}
          priorAssessment={
            latest && latest.evidence.length === 0
              ? (lastEvidenceAssessment ?? null)
              : null
          }
          onOpenSource={openSource}
        />
        <AssumptionLedger
          latest={latest}
          history={history}
          thesis={record.thesis}
          setSource={openSource}
          selectedId={selected?.id}
        />
        {!showDecision && (
          <section className="panel next-action">
            <span className="eyebrow">NEXT</span>
            <h2>Record your decision</h2>
            <p>
              Keep, change, or set aside this idea after reading the result.
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
                Record your decision
              </button>
            </div>
          </section>
        )}
        <details className="panel market-context-details">
          <summary className="detail-summary">
            <span>
              <span className="eyebrow">MARKET</span>
              <strong>Market details</strong>
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
              Bitget is the selected instrument. xStocks is a different product
              for the same company and cannot change this finding.
            </p>
            {latest?.market ? (
              <MarketPanel market={latest.market} instrument={instrument} />
            ) : (
              <p className="muted">
                No saved Bitget observation yet. The latest quote appears beside
                the entry price when you write the idea.
              </p>
            )}
            <XStocksContextPanel
              context={xstocks.data ?? null}
              loading={xstocks.isLoading}
              embedded
            />
          </div>
        </details>
        {!showDecision && (
          <PrintHistory history={history} onSource={openSource} />
        )}
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
      {showDecision ? (
        <aside className="dashboard-aside">{decision}</aside>
      ) : null}
      {latest?.evidence.length ? (
        <EvidenceChatDock
          latest={latest}
          record={record}
          llmStatus={llmStatus}
          statusUnavailable={llmStatusUnavailable}
          onSource={openSource}
        />
      ) : null}
    </div>
  );
}
