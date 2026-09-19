import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import AppTopbar from "../components/AppTopbar";
import EvidenceStep from "../features/journey/EvidenceStep";
import IdeaComposer from "../features/journey/IdeaComposer";
import JourneyProgress from "../features/journey/JourneyProgress";
import DecisionPanel from "../features/journey/DecisionPanel";
import RecordHeader from "../features/journey/RecordHeader";
import ResearchPath from "../features/journey/ResearchPath";
import SourceDrawer from "../SourceDrawer";
import StockPicker from "../features/journey/StockPicker";
import { CompanyLogo } from "../components/Brand";
import ThesisEditor from "../ThesisEditor";
import type { InstrumentId } from "../api/schemas";
import {
  namedDecisionReason,
  unsupportedMetrics,
} from "../lib/conditionHonesty";
import { draftReady } from "../lib/format";
import {
  emptyThesis,
  fromThesisInput,
  defaultThesis,
  manualStarter,
} from "../domain/defaults";
import { useWorkspace } from "../useWorkspace";
import { useMarket } from "../queries/workspace";

export default function Workspace() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const thesisId = !id || id === "new" ? null : id;
  const example = thesisId === null && search.get("example") === "nvidia";
  const initialDraft = useMemo(
    () => (example ? fromThesisInput(defaultThesis) : emptyThesis()),
    [example],
  );
  const [step, setStep] = useState(example ? 2 : thesisId ? 3 : 1);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  const workspace = useWorkspace(
    thesisId,
    (saved) => navigate(`/app/thesis/${saved.id}`, { replace: true }),
    initialDraft,
  );
  const {
    form,
    setForm,
    record,
    history,
    error,
    clearErrors,
    loading,
    pending,
    writing,
    source,
    setSource,
    editing,
    setEditing,
    explanation,
    setExplanation,
    latest,
    create,
    confirm,
    replay,
    refresh,
    decide,
    revise,
    active,
    runStress,
    llmStatus,
    llmStatusUnavailable,
    instruments,
    instrumentsLoading,
    suggestAssumptions,
  } = workspace;

  if (record && hydratedId !== record.id) {
    setHydratedId(record.id);
    setStep(record.retired ? 5 : record.confirmed ? 4 : 3);
  }

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const instrumentId =
    (record?.thesis.instrument_id ?? form.instrument_id) || null;
  const market = useMarket(instrumentId);
  const instrument =
    instruments.find((item) => item.id === instrumentId) ?? null;
  const availableStep = latest
    ? 5
    : record?.confirmed
      ? 5
      : record || form.assumptions.length > 0
        ? 3
        : form.instrument_id
          ? 2
          : 1;
  const lastEvidenceAssessment = [...history.assessments]
    .reverse()
    .find((item) => item.evidence.length > 0);
  const savedWorkspace = Boolean(record?.confirmed && instrument);

  function selectStock(instrumentId: InstrumentId) {
    clearErrors();
    setForm({ ...emptyThesis(), instrument_id: instrumentId });
    setStep(2);
  }

  function continueManually() {
    setForm({
      ...form,
      assumptions:
        form.assumptions.length > 0 ? form.assumptions : [manualStarter()],
    });
    setStep(3);
  }

  function startRevision() {
    if (!record) return;
    setEditing(true);
    setForm(fromThesisInput(record.thesis));
    setStep(3);
  }

  if (loading || (instrumentId && !instrument && instrumentsLoading)) {
    return <p className="page-status">Loading your research…</p>;
  }

  const errorBanner = error && (
    <div
      ref={errorRef}
      role="alert"
      tabIndex={-1}
      className="error actionable-error"
    >
      <span>{error.message}</span>
      <button type="button" onClick={clearErrors}>
        Dismiss
      </button>
    </div>
  );

  return (
    <>
      {savedWorkspace && record && instrument ? (
        <>
          <RecordHeader instrument={instrument} record={record} />
          <ResearchPath
            current={editing ? 3 : step}
            available={availableStep}
            editing={editing}
            onNavigate={setStep}
          />
        </>
      ) : (
        <>
          <AppTopbar>
            <div>
              <Link className="muted" to="/app">
                My research
              </Link>
              {instrument && (
                <>
                  <span className="muted"> / </span>
                  {instrument.display_name}
                </>
              )}
              <span className="version">
                {record ? `v${record.version}` : example ? "Example" : "New"}
              </span>
            </div>
          </AppTopbar>
          {instrument && step !== 1 && (
            <div className="workspace-context">
              <CompanyLogo instrumentId={instrument.id} className="symbol" />
              <div>
                <strong>{instrument.display_name}</strong>
                <p>
                  {instrument.base_coin} / USDT · Bitget ·{" "}
                  <a
                    href={instrument.terms_source}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Instrument terms
                  </a>
                </p>
              </div>
            </div>
          )}
          <JourneyProgress
            current={step}
            available={Math.max(availableStep, step)}
            onNavigate={setStep}
          />
        </>
      )}

      {errorBanner}

      {step === 1 && !savedWorkspace && (
        <StockPicker
          instruments={instruments}
          loading={instrumentsLoading}
          selected={form.instrument_id}
          onSelect={selectStock}
        />
      )}

      {step === 2 && instrument && !savedWorkspace && (
        <section className="panel journey-panel" aria-labelledby="idea-title">
          <h1 id="idea-title">Explain your idea</h1>
          {example && !record && (
            <div className="example-banner">
              Prepared NVIDIA example. Every value is illustrative, not a
              recommendation or current quote.
            </div>
          )}
          <IdeaComposer
            value={form}
            onChange={setForm}
            locked={writing || (!!record?.confirmed && !editing)}
            market={market.data ?? null}
            marketLoading={market.isLoading || market.isFetching}
          />
          <div className="actions journey-actions">
            {!record && (
              <button type="button" onClick={() => setStep(1)}>
                Back
              </button>
            )}
            <button
              type="button"
              className="ai-action"
              disabled={
                writing ||
                !draftReady(llmStatus) ||
                form.rationale.trim().length < 10
              }
              onClick={() =>
                suggestAssumptions(
                  form.instrument_id as InstrumentId,
                  form.rationale,
                  () => setStep(3),
                )
              }
            >
              {pending.suggest
                ? "Drafting conditions…"
                : "Help me draft conditions"}
            </button>
            <button
              type="button"
              className="primary"
              onClick={continueManually}
            >
              Continue manually →
            </button>
          </div>
          <p className="caption">
            {llmStatusUnavailable
              ? "Could not check whether drafting is connected. Continue in your own words; nothing will be sent until the status check works."
              : draftReady(llmStatus)
                ? "Get help writing your idea. Suggestions stay yours to confirm."
                : "Condition drafting is not on this app. Continue in your own words; nothing will be sent to an AI provider."}
          </p>
        </section>
      )}

      {savedWorkspace && record && !editing && step === 2 && (
        <section className="panel journey-panel" aria-labelledby="idea-title">
          <h2 id="idea-title">Your idea</h2>
          <p>{record.thesis.rationale}</p>
          <details className="confirmation-summary">
            <summary>Position and risk inputs</summary>
            <ul>
              <li>{record.thesis.proposed_amount} USDT considered</li>
              <li>{record.thesis.entry_price} USDT proposed entry</li>
              <li>{record.thesis.max_loss} USDT maximum loss</li>
              <li>{record.thesis.holding_days} day time horizon</li>
              <li>{record.thesis.max_slippage_bps} bps slippage limit</li>
            </ul>
          </details>
          {active && (
            <div className="actions journey-actions">
              <button type="button" onClick={startRevision}>
                Change conditions
              </button>
            </div>
          )}
        </section>
      )}

      {step === 3 && instrument && (!savedWorkspace || editing) && (
        <section
          className="panel journey-panel"
          aria-labelledby="assumptions-title"
        >
          <div className="section-heading">
            <div>
              <h1 id="assumptions-title">Review your conditions</h1>
              <p className="lead">
                Confirmation freezes this version. Later changes create a new
                version and preserve the original.
              </p>
            </div>
            <span className="badge">
              {record?.retired
                ? "Set aside"
                : record?.confirmed
                  ? editing
                    ? "Revision"
                    : "Confirmed"
                  : "Draft"}
            </span>
          </div>
          <ThesisEditor
            value={form}
            onChange={setForm}
            locked={
              writing || !!record?.retired || (!!record?.confirmed && !editing)
            }
            supportedMetrics={instrument.supported_metrics}
            companyName={instrument.display_name}
          />
          <details className="confirmation-summary">
            <summary>Position and risk inputs being confirmed</summary>
            <ul>
              <li>{form.proposed_amount || "Missing"} USDT considered</li>
              <li>{form.entry_price || "Missing"} USDT proposed entry</li>
              <li>{form.max_loss || "Missing"} USDT maximum loss</li>
              <li>{form.holding_days || "Missing"} day time horizon</li>
              <li>{form.max_slippage_bps || "Missing"} bps slippage limit</li>
            </ul>
            {!record?.confirmed && (
              <button type="button" onClick={() => setStep(2)}>
                Edit idea and risk inputs
              </button>
            )}
          </details>
          {editing && (
            <label>
              Why are you changing this idea?
              <textarea
                rows={3}
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                placeholder="Explain what changed and which sources matter."
              />
            </label>
          )}
          <div className="actions journey-actions">
            {!record ? (
              <button
                type="button"
                className="primary"
                disabled={writing}
                onClick={create}
              >
                {pending.draft ? "Saving draft…" : "Save draft →"}
              </button>
            ) : !record.confirmed ? (
              <button
                type="button"
                className="primary"
                disabled={
                  writing ||
                  unsupportedMetrics(
                    form.assumptions,
                    instrument.supported_metrics,
                  ).length > 0
                }
                onClick={() => confirm(() => setStep(4))}
              >
                {pending.confirm ? "Saving…" : "Confirm my conditions →"}
              </button>
            ) : editing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setForm(fromThesisInput(record.thesis));
                    setStep(4);
                  }}
                >
                  Cancel revision
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={
                    writing ||
                    explanation.trim().length < 5 ||
                    unsupportedMetrics(
                      form.assumptions,
                      instrument.supported_metrics,
                    ).length > 0
                  }
                  onClick={() => revise(() => setStep(4))}
                >
                  {pending.revise ? "Saving…" : "Save new version →"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={() => setStep(4)}
              >
                Inspect evidence →
              </button>
            )}
          </div>
        </section>
      )}

      {savedWorkspace && instrument && record && !editing && step === 3 && (
        <section
          className="panel journey-panel"
          aria-labelledby="assumptions-title"
        >
          <h2 id="assumptions-title">Confirmed conditions</h2>
          <ThesisEditor
            value={fromThesisInput(record.thesis)}
            onChange={setForm}
            locked
            supportedMetrics={instrument.supported_metrics}
            companyName={instrument.display_name}
          />
          {active && (
            <div className="actions journey-actions">
              <button type="button" onClick={startRevision}>
                Change conditions
              </button>
            </div>
          )}
        </section>
      )}

      {(step === 4 || step === 5) &&
        instrument &&
        record?.confirmed &&
        !editing && (
          <EvidenceStep
            writing={writing}
            pending={pending}
            active={active}
            replay={replay}
            refresh={refresh}
            latest={latest}
            reviewWithAI={workspace.reviewWithAI}
            reviewFailed={workspace.reviewFailed}
            llmStatus={llmStatus}
            llmStatusUnavailable={llmStatusUnavailable}
            instrument={instrument}
            history={history}
            runStress={runStress}
            record={record}
            lastEvidenceAssessment={lastEvidenceAssessment}
            onOpenSourceDetails={setSource}
            onChangeConditions={startRevision}
            onRecordDecision={() => setStep(5)}
            showDecision={step === 5}
            decision={
              <DecisionPanel
                record={record}
                latest={latest}
                active={active}
                writing={writing}
                pending={pending.decide}
                explanation={decisionNote}
                onExplanation={setDecisionNote}
                onKeep={(calls) => decide("retain", calls, decisionNote)}
                onSetAside={(calls) => decide("retire", calls, decisionNote)}
                onChangeConditions={(calls) => {
                  const rows = (latest?.assumptions ?? []).map((item) => ({
                    id: item.assumption_id,
                    claim:
                      record.thesis.assumptions.find(
                        (assumption) => assumption.id === item.assumption_id,
                      )?.claim ?? item.assumption_id,
                  }));
                  setExplanation(
                    namedDecisionReason(rows, calls, decisionNote),
                  );
                  startRevision();
                }}
              />
            }
          />
        )}

      <SourceDrawer evidence={source} onClose={() => setSource(null)} />
    </>
  );
}
