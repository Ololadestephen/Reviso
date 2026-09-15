const labels = ["Choose", "Explain", "Review"];

export default function JourneyProgress({
  current,
  available,
  onNavigate,
}: {
  current: number;
  available: number;
  onNavigate: (step: number) => void;
}) {
  return (
    <nav className="journey-progress" aria-label="Research steps">
      {labels.map((label, index) => {
        const step = index + 1;
        return (
          <button
            type="button"
            key={label}
            className={current === step ? "current" : ""}
            disabled={step > available}
            aria-current={current === step ? "step" : undefined}
            onClick={() => onNavigate(step)}
          >
            <span>{step}</span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
