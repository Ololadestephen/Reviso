const stages = [
  { step: 2, label: "Idea" },
  { step: 3, label: "Conditions" },
  { step: 4, label: "Evidence" },
  { step: 5, label: "Decision" },
] as const;

export default function ResearchPath({
  current,
  available,
  editing = false,
  onNavigate,
}: {
  current: number;
  available: number;
  editing?: boolean;
  onNavigate: (step: number) => void;
}) {
  return (
    <nav className="research-path" aria-label="Research path">
      {stages.map((stage, index) => {
        const locked = editing && stage.step !== 3;
        const reachable = !locked && stage.step <= available;
        return (
          <span className="research-path-item" key={stage.label}>
            {index > 0 && <i aria-hidden="true" />}
            <button
              type="button"
              className={current === stage.step ? "current" : ""}
              disabled={!reachable}
              aria-current={current === stage.step ? "step" : undefined}
              onClick={() => onNavigate(stage.step)}
            >
              {stage.label}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
