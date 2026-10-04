import { useEffect, useState, type ReactNode } from "react";
import AssumptionLedger from "../../AssumptionLedger";
import ReplayPanel from "../../ReplayPanel";
import EvidenceChatDock from "./EvidenceChatDock";
import ResearchOptions from "./ResearchOptions";
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
      return null;
    });
  }, [currentIds, priorIds, latest, lastEvidenceAssessment]);

  function openSource(evidence: Evidence) {
    setSelected(evidence);
    onOpenSourceDetails(evidence);
  }

  return (
    <div
      className={`research-dashboard${showDecision ? " decision-focus" : " evidence-first"}`}
    >
      <div className="dashboard-main">
        <section
          className="panel result-workbench"
          aria-label="Research result"
        >
          <ReplayPanel
            writing={writing}
            pending={pending}
            active={active}
            refresh={refresh}
            latest={latest}
            reviewWithAI={reviewWithAI}
            reviewFailed={reviewFailed}
            llmStatus={llmStatus}
            instrument={instrument}
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
            <footer className="next-action">
              <div>
                <h2>Your next step</h2>
                <p>Keep, change or set aside your idea.</p>
              </div>
              <div className="actions journey-actions">
                {active && (
                  <button type="button" onClick={onChangeConditions}>
                    Edit conditions
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
            </footer>
          )}
        </section>
        <ResearchOptions
          latest={latest}
          history={history}
          instrument={instrument}
          record={record}
          active={active}
          writing={writing}
          pending={pending}
          replay={replay}
          runStress={runStress}
          onSource={openSource}
          showDecision={showDecision}
        />
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
