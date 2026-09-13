import type { ReactNode } from "react";
import { CompanyLogo, RevisoMark } from "./Brand";

function ConditionRow({
  state,
  children,
}: {
  state: "supported" | "attention" | "unknown";
  children: ReactNode;
}) {
  const label =
    state === "supported"
      ? "Supported"
      : state === "attention"
        ? "Needs attention"
        : "Not enough evidence";
  return (
    <div className="preview-condition">
      <span className={`preview-status ${state}`} aria-hidden="true" />
      <span>{children}</span>
      <small>{label}</small>
    </div>
  );
}

export default function ProductPreview({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className={`product-preview ${compact ? "compact" : ""}`}
      role="img"
      aria-label="Example Reviso screen showing an NVIDIA research idea, three conditions, and cited evidence"
    >
      <div className="preview-sidebar" aria-hidden="true">
        <RevisoMark className="preview-logo" />
        <span className="preview-nav-item selected">▤</span>
        <span className="preview-nav-item">＋</span>
        <span className="preview-nav-item">◫</span>
      </div>
      <div className="preview-workspace">
        <div className="preview-topbar">
          <span>Research idea</span>
          <span className="preview-version">Saved version 2</span>
        </div>
        <div className="preview-title-row">
          <div>
            <small>NVIDIA · EXAMPLE</small>
            <strong>Data-centre demand can remain strong</strong>
          </div>
          <CompanyLogo instrumentId="RNVDAUSDT" className="preview-company" />
        </div>
        <div className="preview-steps" aria-hidden="true">
          <span className="done">1</span>
          <i />
          <span className="done">2</span>
          <i />
          <span className="done">3</span>
          <i />
          <span className="current">4</span>
          <i />
          <span>5</span>
        </div>
        <div className="preview-grid">
          <section className="preview-card">
            <small>WHAT NEEDS TO STAY TRUE</small>
            <h3>Your conditions</h3>
            <ConditionRow state="supported">
              Reported revenue growth remains positive
            </ConditionRow>
            <ConditionRow state="attention">
              Gross margin stays above your chosen level
            </ConditionRow>
            <ConditionRow state="unknown">
              Customer demand remains broad
            </ConditionRow>
          </section>
          <section className="preview-card preview-evidence">
            <small>LATEST CHECK · EXAMPLE</small>
            <h3>Evidence needs attention</h3>
            <p>
              Two conditions have reported measures. One still needs manual
              research.
            </p>
            <div className="preview-chart" aria-label="Evidence coverage chart">
              <div className="preview-chart-heading">
                <span>Evidence coverage</span>
                <strong>2 of 3 measured</strong>
              </div>
              <svg viewBox="0 0 300 100" aria-hidden="true">
                <path
                  className="chart-grid"
                  d="M16 20H290M16 50H290M16 80H290"
                />
                <path
                  className="chart-area"
                  d="M16 78C55 70 66 53 102 59S158 37 191 43s58-24 99-22v59H16Z"
                />
                <path
                  className="chart-line"
                  d="M16 78C55 70 66 53 102 59S158 37 191 43s58-24 99-22"
                />
                <circle cx="290" cy="21" r="5" />
              </svg>
              <div className="preview-chart-labels">
                <span>Older filing</span>
                <span>Latest release</span>
              </div>
            </div>
            <div className="preview-source">
              <span>↗</span>
              <div>
                <strong>Quarterly company release</strong>
                <small>Official source · date shown in app</small>
              </div>
            </div>
            <button type="button" tabIndex={-1}>
              Open source
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
