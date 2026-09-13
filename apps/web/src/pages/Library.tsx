import { Link } from "react-router-dom";
import { useInstruments, useTheses } from "../queries/workspace";
import { stateLabel } from "../lib/format";
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
      <header>
        <div>Research</div>
        <Link className="button-link primary" to="/app/thesis/new">
          New research
        </Link>
      </header>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SAVED RESEARCH</span>
          <h1>
            Know what would
            <br />
            change your mind.
          </h1>
          <p className="muted">
            Choose a company, explain your idea, decide what would change your
            mind, and check that rule against cited evidence.
          </p>
          <div className="actions">
            <Link className="button-link primary" to="/app/thesis/new">
              Start new research
            </Link>
            <Link className="button-link" to="/example">
              View the NVIDIA example
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="error">
          {error.message}
        </div>
      )}

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">RESEARCH LIBRARY</span>
            <h2>{theses ? `${theses.length} saved` : "Your theses"}</h2>
          </div>
        </div>

        {isLoading && (
          <div className="empty" role="status">
            Loading your saved theses…
          </div>
        )}

        {theses?.length === 0 && (
          <div className="empty">
            No saved research yet. The guided flow takes you from a company and
            an idea to a cited decision record.
          </div>
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
                    {thesis.rationale}
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
                  ? `Last assessed ${new Date(thesis.assessed_at).toLocaleString()} · ${thesis.mode?.replaceAll("_", " ").toLowerCase()}`
                  : "Evidence not checked yet. Confirm the conditions, then load the sources."}
              </p>
            </article>
          );
        })}
      </section>
    </>
  );
}
