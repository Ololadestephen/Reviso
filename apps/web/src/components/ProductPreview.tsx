import type { ReactNode } from "react";
import { CompanyLogo, RevisoMark } from "./Brand";

function ConditionRow({
  beat,
  state,
  children,
}: {
  beat: 1 | 2 | 3;
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
    <div className="preview-condition" data-beat={beat}>
      <span className={`preview-status ${state}`} aria-hidden="true" />
      <span>{children}</span>
      <small>{label}</small>
    </div>
  );
}

export default function ProductPreview({ live = false }: { live?: boolean }) {
  return (
    <div
      className={live ? "product-preview preview-live" : "product-preview"}
      role="img"
      aria-label="Example Reviso screen showing an NVIDIA research idea, three conditions, and a dated source"
    >
      <div className="preview-sidebar" aria-hidden="true">
        <RevisoMark className="preview-logo" />
        <span className="preview-nav-item selected">▤</span>
        <span className="preview-nav-item">＋</span>
        <span className="preview-nav-item">◫</span>
      </div>
      <div className="preview-workspace">
        <div className="preview-live-sheen" aria-hidden="true" />
        <div className="preview-topbar">
          <span>Research idea</span>
          <span className="preview-version">Saved version 2 · example</span>
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
            <ConditionRow beat={1} state="supported">
              Reported revenue growth remains positive
            </ConditionRow>
            <ConditionRow beat={2} state="attention">
              Gross margin stays above your chosen level
            </ConditionRow>
            <ConditionRow beat={3} state="unknown">
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
            <div className="preview-source">
              <span aria-hidden="true">↗</span>
              <div>
                <strong>Quarterly company release</strong>
                <small>Official source · date shown in the app</small>
              </div>
            </div>
            <span className="preview-filing">View filing</span>
          </section>
        </div>
      </div>
    </div>
  );
}
