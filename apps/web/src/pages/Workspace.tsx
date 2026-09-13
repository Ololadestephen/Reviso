import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import AssumptionLedger from "../AssumptionLedger";
import IdeaComposer from "../features/journey/IdeaComposer";
import JourneyProgress from "../features/journey/JourneyProgress";
import ReplayPanel from "../ReplayPanel";
import ResearchQuestions from "../features/journey/ResearchQuestions";
import ScenarioExplorer from "../ScenarioExplorer";
import SourceDrawer from "../SourceDrawer";
import StockPicker from "../features/journey/StockPicker";
import { CompanyLogo } from "../components/Brand";
import ThesisEditor from "../ThesisEditor";
import { exportThesisUrl } from "../api/endpoints";
import type { InstrumentId } from "../api/schemas";
import {
  emptyThesis,
  fromThesisInput,
  defaultThesis,
  manualStarter,
} from "../domain/defaults";
import { stateLabel } from "../lib/format";
import { useWorkspace } from "../useWorkspace";

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
    instruments,
    instrumentsLoading,
    questions,
    suggestAssumptions,
    askQuestion,
  } = workspace;

  useEffect(() => {
    if (record && hydratedId !== record.id) {
      setHydratedId(record.id);
      setStep(record.retired ? 5 : record.confirmed ? 4 : 3);
    }
  }, [hydratedId, record]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const instrumentId =
    (record?.thesis.instrument_id ?? form.instrument_id) || null;
  const instrument =
    instruments.find((item) => item.id === instrumentId) ?? null;
  const availableStep = latest
    ? 5
    : record?.confirmed
      ? 4
      : record || form.assumptions.length > 0
        ? 3
        : form.instrument_id
          ? 2
          : 1;
  const lastEvidenceAssessment = [...history.assessments]
    .reverse()
    .find((item) => item.evidence.length > 0);

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

  if (loading || (instrumentId && !instrument && instrumentsLoading)) {
    return <p className="page-status">Loading your research…</p>;
  }

  return (
    <>
      <header>
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
        {record && (
          <Link
            className="button-link"
            to={`/app/thesis/${record.id}/timeline`}
          >
            Decision history →
          </Link>
        )}
      </header>

      <div className="journey-heading">
        <div>
          <span className="eyebrow">YOUR RESEARCH IDEA</span>
          <h1>Know what would change your mind.</h1>
          <p className="muted">
            Set clear conditions, check dated sources, then record your own
            decision. Reviso cannot place a trade.
          </p>
        </div>
        {instrument && (
          <div className="instrument">
            <CompanyLogo instrumentId={instrument.id} className="symbol" />
            <div>
              <strong>{instrument.display_name}</strong>
              <p>{instrument.base_coin} / USDT · Bitget</p>
              <a
                href={instrument.terms_source}
                target="_blank"
                rel="noreferrer"
              >
                Instrument terms ↗
              </a>
            </div>
          </div>
        )}
      </div>

      <JourneyProgress
        current={step}
        available={Math.max(availableStep, step)}
        onNavigate={setStep}
      />

      {error && (
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
      )}

      {step === 1 && (
        <StockPicker
          instruments={instruments}
          loading={instrumentsLoading}
          selected={form.instrument_id}
          onSelect={selectStock}
        />
      )}

      {step === 2 && instrument && (
        <section className="panel journey-panel" aria-labelledby="idea-title">
          <span className="eyebrow">STEP 2 OF 5</span>
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
                !llmStatus.configured ||
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
                ? "Qwen is drafting conditions…"
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
            {llmStatus.configured
              ? "Qwen receives your company choice and idea only. Suggestions remain editable and are not saved or confirmed automatically."
              : "Qwen is unavailable in this environment. Continue manually; nothing will be sent to an AI provider."}
          </p>
        </section>
      )}

      {step === 3 && instrument && (
        <section
          className="panel journey-panel"
          aria-labelledby="assumptions-title"
        >
          <span className="eyebrow">STEP 3 OF 5</span>
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
                disabled={writing}
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
                  disabled={writing || explanation.trim().length < 5}
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

      {step === 4 && instrument && record?.confirmed && (
        <>
          <section className="journey-intro">
            <span className="eyebrow">STEP 4 OF 5</span>
            <h1>Inspect the evidence</h1>
            <p className="lead">
              Start with the saved result. Open the source when a finding
              matters, and keep missing information visible.
            </p>
          </section>
          <div className="workspace-grid evidence-grid">
            <div>
              <ReplayPanel
                writing={writing}
                pending={pending}
                active={active}
                replay={replay}
                refresh={refresh}
                latest={latest}
                reviewWithAI={workspace.reviewWithAI}
                llmStatus={llmStatus}
                instrument={instrument}
              />
              {latest &&
                latest.evidence.length === 0 &&
                lastEvidenceAssessment && (
                  <section className="panel recovery-panel">
                    <span className="eyebrow">LAST SAVED EVIDENCE</span>
                    <h2>The latest check did not erase your prior sources</h2>
                    <p>
                      This evidence belongs to the earlier assessment from{" "}
                      {new Date(
                        lastEvidenceAssessment.evaluated_at,
                      ).toLocaleString()}
                      . It is preserved for context and is not presented as the
                      current result.
                    </p>
                    <div className="evidence-links">
                      {lastEvidenceAssessment.evidence.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setSource(item)}
                        >
                          ↗ {item.title}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              <AssumptionLedger
                latest={latest}
                history={history}
                setSource={setSource}
              />
            </div>
            <div>
              {latest?.evidence.length ? (
                <ResearchQuestions
                  latest={latest}
                  answers={questions}
                  pending={pending.question}
                  llmStatus={llmStatus}
                  onAsk={askQuestion}
                  onSource={setSource}
                />
              ) : (
                <section className="panel unknown">
                  <span className="eyebrow">NEXT USEFUL ACTION</span>
                  <h2>Load current evidence</h2>
                  <p>
                    Reviso needs a saved company disclosure before it can
                    provide cited follow-up answers.
                  </p>
                </section>
              )}
              <details className="advanced-panel">
                <summary>Advanced controlled stress test</summary>
                <ScenarioExplorer
                  key={`${record.id}-${record.version}-${latest?.input_hash}`}
                  disabled={!active || writing}
                  pending={pending.stress}
                  initial={latest?.numerical ?? null}
                  scenario={latest?.scenario}
                  onRun={runStress}
                />
              </details>
              <section className="panel unknown">
                <span className="eyebrow">WHAT REMAINS UNKNOWN</span>
                <h2>
                  {latest?.next_question ??
                    "What evidence would change your view?"}
                </h2>
                <ul>
                  {(
                    latest?.missing ?? [
                      "Current company evidence has not been loaded",
                      "Token terms and redemption availability",
                    ]
                  ).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
          <div className="actions journey-actions bottom-actions">
            {active && (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setForm(fromThesisInput(record.thesis));
                  setStep(3);
                }}
              >
                Change conditions
              </button>
            )}
            <button
              type="button"
              className="primary"
              disabled={!latest}
              onClick={() => setStep(5)}
            >
              Record my decision →
            </button>
          </div>
        </>
      )}

      {step === 5 && instrument && record && (
        <section className="panel journey-panel decision-step">
          <span className="eyebrow">STEP 5 OF 5</span>
          <h1>Record your decision</h1>
          <div className="decision-state">
            <span>Current evidence result</span>
            <strong
              className={latest?.state === "INVALIDATED" ? "negative" : ""}
            >
              {latest ? stateLabel(latest.state) : "No saved assessment"}
            </strong>
          </div>
          {active ? (
            <>
              <label>
                Why are you making this decision?
                <textarea
                  value={explanation}
                  onChange={(event) => setExplanation(event.target.value)}
                  placeholder="Which sources matter, what remains uncertain, and why are you making this choice?"
                  rows={4}
                />
              </label>
              <div className="actions journey-actions">
                <button
                  type="button"
                  disabled={writing || explanation.trim().length < 5}
                  onClick={() => decide("retain")}
                >
                  {pending.decide ? "Saving…" : "Keep idea"}
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={writing || explanation.trim().length < 5}
                  onClick={() => decide("retire")}
                >
                  Set idea aside
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setForm(fromThesisInput(record.thesis));
                    setStep(3);
                  }}
                >
                  Change it instead
                </button>
              </div>
            </>
          ) : (
            <div className="callout">
              This idea has been set aside. Its history remains available.
            </div>
          )}
          <div className="export-block">
            <div>
              <h2>Take your research with you</h2>
              <p className="muted">
                Exports use saved data only and keep dates, citations, version
                history, and limitations.
              </p>
            </div>
            <div className="actions">
              <a
                className="button-link"
                href={exportThesisUrl(record.id, "markdown", record.version)}
                download
              >
                Download Markdown
              </a>
              <a
                className="button-link"
                href={exportThesisUrl(record.id, "json", record.version)}
                download
              >
                Download JSON
              </a>
            </div>
          </div>
        </section>
      )}

      <SourceDrawer evidence={source} onClose={() => setSource(null)} />
    </>
  );
}
