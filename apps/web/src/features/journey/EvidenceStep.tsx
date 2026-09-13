import { useEffect, useState } from "react";
import AssumptionLedger from "../../AssumptionLedger";
import MarketPanel from "../../MarketPanel";
import ReplayPanel from "../../ReplayPanel";
import ScenarioExplorer from "../../ScenarioExplorer";
import EvidenceChat from "./EvidenceChat";
import SelectedSource from "./SelectedSource";
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
  instrument,
  history,
  runStress,
  record,
  lastEvidenceAssessment,
  onOpenSourceDetails,
  onChangeConditions,
  onRecordDecision,
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
  instrument: Instrument;
  history: History;
  runStress: (scenario: StressScenario) => Promise<Numerical>;
  record: ThesisRecord;
  lastEvidenceAssessment: Assessment | undefined;
  onOpenSourceDetails: (evidence: Evidence | null) => void;
  onChangeConditions: () => void;
  onRecordDecision: () => void;
}) {
  const [selected, setSelected] = useState<Evidence | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
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

  return (
    <>
      <section className="journey-intro">
        <h1>Does the evidence support your idea?</h1>
        <p className="lead">
          Here is what the latest filing says about the conditions you
          confirmed. Read each one, open the report, then decide.
        </p>
      </section>
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
        chatOpen={chatOpen}
        onOpenChat={() => setChatOpen(true)}
        priorAssessment={
          latest && latest.evidence.length === 0
            ? (lastEvidenceAssessment ?? null)
            : null
        }
        onOpenSource={setSelected}
      />
      <div className="evidence-board">
        <AssumptionLedger
          latest={latest}
          history={history}
          setSource={setSelected}
          selectedId={selected?.id}
        />
        <SelectedSource
          evidence={selected}
          current={current}
          onOpenDetails={onOpenSourceDetails}
        />
      </div>
      <div className="actions journey-actions bottom-actions">
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
      <details className="advanced-panel">
        <summary>Advanced checks</summary>
        {latest?.market && (
          <MarketPanel market={latest.market} instrument={instrument} />
        )}
        <ScenarioExplorer
          key={`${record.id}-${record.version}-${latest?.input_hash}`}
          disabled={!active || writing}
          pending={pending.stress}
          initial={latest?.numerical ?? null}
          scenario={latest?.scenario}
          onRun={runStress}
        />
      </details>
      {chatOpen && latest?.evidence.length ? (
        <EvidenceChat
          open={chatOpen}
          latest={latest}
          record={record}
          llmStatus={llmStatus}
          onClose={() => setChatOpen(false)}
          onSource={setSelected}
        />
      ) : null}
    </>
  );
}
