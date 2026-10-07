import type { Assessment, Evidence } from "../../api/schemas";
import { sourceKindLabel } from "../../lib/researchSources";

const providers = [
  [
    "SEC",
    "Company report",
    "Management discussion and risks from the saved report period.",
  ],
  ["FED", "Fed policy", "The latest available interest-rate statement."],
  ["BLS", "Inflation and jobs", "Dated US inflation and employment releases."],
] as const;

export default function OfficialResearch({
  latest,
  writing,
  pending,
  active,
  onLoad,
  onSource,
  onExplain,
  aiReady,
  explaining,
}: {
  latest: Assessment;
  writing: boolean;
  pending: boolean;
  active: boolean;
  onLoad: () => void;
  onSource: (source: Evidence) => void;
  onExplain: () => void;
  aiReady: boolean;
  explaining: boolean;
}) {
  const current = latest.mode === "LIVE_REFRESH";
  const loaded = latest.research_retrieval !== undefined;
  return (
    <details className="panel official-research">
      <summary>
        More research{" "}
        <span className="muted">Company reports, Fed and BLS</span>
      </summary>
      <p>
        Go beyond the numbers. Company statements help explain the business; Fed
        and BLS releases show the wider economy.
      </p>
      <ul className="official-provider-list">
        {providers.map(([id, title, description]) => {
          const retrieval = latest.research_retrieval?.find(
            (item) => item.provider === id,
          );
          return (
            <li key={id}>
              <strong>{title}</strong>
              <p className="muted">{description}</p>
              {retrieval && (
                <span className="badge">
                  {retrieval.availability === "AVAILABLE"
                    ? "Loaded"
                    : retrieval.availability === "PARTIAL"
                      ? "Partly loaded"
                      : "Unavailable"}
                </span>
              )}
              {retrieval?.warnings.length ? (
                <details>
                  <summary>Source status</summary>
                  <ul>
                    {retrieval.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
      {latest.research_sources?.length ? (
        <ul className="official-source-list">
          {latest.research_sources.map((source) => (
            <li key={source.id}>
              <span className="eyebrow">{sourceKindLabel(source)}</span>
              <button className="text-link" onClick={() => onSource(source)}>
                {source.title}
              </button>
              <small className="muted">
                {source.publisher} ·{" "}
                {new Date(source.published_at).toLocaleDateString(undefined, {
                  timeZone: "UTC",
                })}
              </small>
            </li>
          ))}
        </ul>
      ) : null}
      {current ? (
        <>
          <button disabled={writing || !active} onClick={onLoad}>
            {pending
              ? "Loading official research…"
              : loaded
                ? "Refresh these sources"
                : "Load official research"}
          </button>
          <p className="muted">
            Saves a new check using your existing filing. It does not refresh
            the filing or price, or make an AI call. These sources do not supply
            missing numbers.
          </p>
          {loaded && (
            <p className="muted">
              You can ask the chat about loaded sources. Request a new AI
              explanation when you are ready.
            </p>
          )}
          {loaded && aiReady && latest.research_sources?.length ? (
            <button disabled={writing || !active} onClick={onExplain}>
              {explaining
                ? "Writing explanation…"
                : "Explain with these sources"}
            </button>
          ) : null}
          {loaded && aiReady && latest.research_sources?.length ? (
            <small className="muted">
              AI explanations and chat use your AI allowance.
            </small>
          ) : null}
        </>
      ) : (
        <p className="muted">
          Check a current filing first. Today's releases are not added to
          historical examples or test scenarios.
        </p>
      )}
    </details>
  );
}
