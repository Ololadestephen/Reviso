import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import Timeline from "../Timeline";
import SourceDrawer from "../SourceDrawer";
import { useHistory } from "../queries/workspace";
import type { Evidence } from "../api/schemas";

const emptyHistory = {
  versions: [],
  assessments: [],
  events: [],
  selected_assessment: null,
};

export default function ThesisTimeline() {
  const { id } = useParams<{ id: string }>();
  const [source, setSource] = useState<Evidence | null>(null);
  const { data: history, isLoading, error } = useHistory(id ?? null);

  return (
    <>
      <header>
        <div>
          <Link className="muted" to="/app">
            My research
          </Link>
          <span className="muted"> / </span>Decision timeline
        </div>
        <Link className="button-link" to={`/app/thesis/${id}`}>
          ← Back to research
        </Link>
      </header>

      {error && (
        <div role="alert" className="error">
          {error.message}
        </div>
      )}
      {isLoading && (
        <p role="status" className="muted">
          Loading the decision history…
        </p>
      )}

      <Timeline history={history ?? emptyHistory} onSource={setSource} />
      <SourceDrawer evidence={source} onClose={() => setSource(null)} />
    </>
  );
}
