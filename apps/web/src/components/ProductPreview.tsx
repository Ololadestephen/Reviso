import type { ReactNode } from "react";
import { CompanyLogo, RevisoMark } from "./Brand";

function ConditionRow({
  beat,
  state,
  children,
}: {
  beat: 1 | 2 | 3;
  state: "supported" | "invalidated" | "history";
  children: ReactNode;
}) {
  const label =
    state === "supported"
      ? "Supported"
      : state === "invalidated"
        ? "Did not hold"
        : "History kept";
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
      aria-label="Example Reviso screen of an NVIDIA idea: Q3 margin below 75% did not hold, growth still held, and the Q2 print stays in history"
    >
      <div className="preview-sidebar" aria-hidden="true">
        <RevisoMark className="preview-logo" />
        <span className="preview-nav-item selected">▤</span>
        <span className="preview-nav-item">＋</span>
      </div>
      <div className="preview-workspace">
        <div className="preview-live-sheen" aria-hidden="true" />
        <div className="preview-topbar">
          <span>Research idea</span>
          <span className="preview-version">Saved version 1 · example</span>
        </div>
        <div className="preview-title-row">
          <div>
            <small>NVIDIA · EXAMPLE</small>
            <strong>Reported performance can keep those two floors</strong>
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
        </div>
        <div className="preview-grid">
          <section className="preview-card">
            <small>WHAT NEEDS TO STAY TRUE</small>
            <h3>Your conditions</h3>
            <ConditionRow beat={1} state="invalidated">
              GAAP gross margin stays at or above 75%
            </ConditionRow>
            <ConditionRow beat={2} state="supported">
              Year-over-year revenue growth stays at or above 80%
            </ConditionRow>
            <ConditionRow beat={3} state="history">
              Q2 print: both floors held
            </ConditionRow>
          </section>
          <section className="preview-card preview-evidence">
            <small>FY2025 Q3 PRINT · EXAMPLE</small>
            <h3>The result is mixed</h3>
            <p>
              Margin 74.6% is below 75%. Growth 94% still clears 80%. The Q2
              print is unchanged.
            </p>
            <div className="preview-source">
              <span aria-hidden="true">↗</span>
              <div>
                <strong>NVIDIA fiscal 2025 third-quarter release</strong>
                <small>Official source · 21 November 2024</small>
              </div>
            </div>
            <span className="preview-filing">View filing</span>
          </section>
        </div>
      </div>
    </div>
  );
}
