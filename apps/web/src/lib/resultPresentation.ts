import type { Assessment, Evidence } from "../api/schemas";

/** Labels for saved findings only; no financial comparisons run in the UI. */
export function resultHeading(latest: Assessment | null) {
  if (!latest) return "Check your conditions";
  if (latest.state === "INVALIDATED") {
    const failed = latest.assumptions.filter(
      (item) => item.state === "INVALIDATED",
    ).length;
    return failed > 1
      ? `${failed} conditions did not hold`
      : "One condition did not hold";
  }
  if (latest.state === "INSUFFICIENT_EVIDENCE")
    return "More evidence is needed";
  if (latest.state === "CHALLENGED") return "A condition needs a closer look";
  return latest.assumptions.some((item) => item.state !== "SUPPORTED")
    ? "Required conditions are supported"
    : "Your conditions are supported";
}

export function resultCounts(latest: Assessment) {
  const labels = {
    SUPPORTED: "supported",
    INVALIDATED: "did not hold",
    INSUFFICIENT_EVIDENCE: "need evidence",
    CHALLENGED: "need a closer look",
  } as const;
  return Object.entries(labels).flatMap(([state, label]) => {
    const count = latest.assumptions.filter(
      (item) => item.state === state,
    ).length;
    const countedLabel =
      count === 1 && label.startsWith("need ")
        ? label.replace("need ", "needs ")
        : label;
    return count ? [`${count} ${countedLabel}`] : [];
  });
}

export function newestSource(evidence: Evidence[]) {
  return evidence.reduce<Evidence | undefined>((latest, item) => {
    if (
      !latest ||
      new Date(item.published_at).getTime() >
        new Date(latest.published_at).getTime()
    )
      return item;
    return latest;
  }, undefined);
}

export function reportDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function resultMode(mode: Assessment["mode"]) {
  if (mode === "HISTORICAL_REPLAY") return "Historical example";
  if (mode === "CONTROLLED_SCENARIO") return "What-if check";
  return "Company report";
}
