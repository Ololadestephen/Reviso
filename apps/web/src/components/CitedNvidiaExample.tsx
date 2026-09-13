import { Link } from "react-router-dom";

export default function CitedNvidiaExample({
  sourceToExample = false,
}: {
  sourceToExample?: boolean;
}) {
  return (
    <article className="cited-example-card">
      <header>
        <div>
          <span className="eyebrow">EXAMPLE · NVIDIA · FY2025 Q3</span>
          <h2 id="cited-example-title">One condition, one dated print.</h2>
        </div>
        <span className="badge invalidated">Invalidated</span>
      </header>
      <dl>
        <div>
          <dt>Condition</dt>
          <dd>GAAP gross margin stays at or above 75%</dd>
        </div>
        <div>
          <dt>Reported</dt>
          <dd>74.6% in the third-quarter release</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            {sourceToExample ? (
              <Link to="/example">
                NVIDIA investor relations excerpt · available 21 Nov 2024
              </Link>
            ) : (
              "NVIDIA investor relations excerpt · available 21 Nov 2024"
            )}
          </dd>
        </div>
      </dl>
      <p className="cited-example-note">
        This is a dated research example, not a current view or a
        recommendation.
      </p>
    </article>
  );
}
