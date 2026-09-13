import { Link } from "react-router-dom";
import AppTopbar from "../components/AppTopbar";
import { useInstruments, useTheses } from "../queries/workspace";
import { ideaTitle, stateLabel } from "../lib/format";
import type { ThesisSummary } from "../api/schemas";

function statusBadge(thesis: ThesisSummary) {
  if (thesis.retired) return { label: "Set aside", tone: "" };
  if (!thesis.confirmed) return { label: "Draft", tone: "amber" };
  if (!thesis.state) return { label: "Confirmed · not checked", tone: "" };
  return { label: stateLabel(thesis.state), tone: thesis.state.toLowerCase() };
}

export default function Library() {
  const { data: theses, isLoading, error } = useTheses();
  const { data: instruments } = useInstruments();

  return (
    <>
      <AppTopbar>
        <h1>Your research</h1>
        <Link className="button-link app-topbar-cta" to="/app/thesis/new">
          New research
        </Link>
      </AppTopbar>
      <p className="lead library-lead">
        Write the condition, check a dated source, then record your decision.
      </p>

      {error && (
        <div role="alert" className="error">
          {error.message}
        </div>
      )}

      <section className="panel" aria-label="Saved research">
        {isLoading && (
          <div className="empty" role="status">
            Loading your saved research…
          </div>
        )}

        {theses?.length === 0 && (
          <div className="empty">
            <p>
              No saved research yet. Start with a company, write what would
              change your mind, and check a dated source.
            </p>
            <Link to="/example">View the NVIDIA example</Link>
          </div>
        )}

        {theses && theses.length > 0 && (
          <p className="caption library-count">{theses.length} saved</p>
        )}

        {theses?.map((thesis) => {
          const badge = statusBadge(thesis);
          const instrument = instruments?.find(
            (item) => item.id === thesis.instrument_id,
          );
          return (
            <article className="ledger-item" key={thesis.id}>
              <div className="ledger-heading">
                <strong>
                  <Link to={`/app/thesis/${thesis.id}`}>
                    {ideaTitle(thesis.rationale)}
                  </Link>
                </strong>
                <span className={`badge ${badge.tone}`}>{badge.label}</span>
              </div>
              <p>
                {instrument?.display_name ?? thesis.instrument_id} · v
                {thesis.version} · {thesis.assumption_count} conditions ·
                started {new Date(thesis.created_at).toLocaleDateString()}
              </p>
              <p className="caption">
                {thesis.assessed_at
                  ? `Last assessed ${new Date(thesis.assessed_at).toLocaleString()}`
                  : "Evidence not checked yet."}
              </p>
            </article>
          );
        })}
      </section>
    </>
  );
}
