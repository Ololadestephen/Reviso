import type { Metric, State } from "../api/schemas";

export type ConditionCall = "held" | "broke" | "missing";

const CHECKABLE: Metric[] = ["gaap_margin_pct", "revenue_growth_yoy_pct"];

export function metricLabel(metric: Metric) {
  if (metric === "gaap_margin_pct") return "Reported GAAP gross margin";
  if (metric === "revenue_growth_yoy_pct") {
    return "Reported year-over-year revenue growth";
  }
  return "Manual research (not a filing comparison)";
}

export function checkableMetrics(supported: Metric[] | undefined): Metric[] {
  const allowed = new Set(supported ?? CHECKABLE);
  return CHECKABLE.filter((metric) => allowed.has(metric));
}

export function unsupportedMetrics(
  assumptions: { metric: Metric }[],
  supported: Metric[] | undefined,
) {
  if (!supported) return [];
  const allowed = new Set(supported);
  return assumptions
    .map((item) => item.metric)
    .filter((metric) => !allowed.has(metric));
}

export function defaultConditionCall(state: State): ConditionCall {
  if (state === "SUPPORTED") return "held";
  if (state === "INVALIDATED") return "broke";
  return "missing";
}

export function conditionsNamed(
  ids: string[],
  calls: Record<string, ConditionCall>,
) {
  return ids.every((id) => Boolean(calls[id]));
}

export function groupConditionCalls(calls: Record<string, ConditionCall>) {
  const held: string[] = [];
  const broke: string[] = [];
  const missing: string[] = [];
  for (const [id, call] of Object.entries(calls)) {
    if (call === "held") held.push(id);
    else if (call === "broke") broke.push(id);
    else missing.push(id);
  }
  return { held, broke, missing };
}

export function namedDecisionReason(
  rows: { id: string; claim: string }[],
  calls: Record<string, ConditionCall>,
  reason: string,
) {
  const labels = (call: ConditionCall) =>
    rows
      .filter((row) => calls[row.id] === call)
      .map((row) => row.claim.replace(/\.+$/, ""))
      .join("; ") || "none";
  return (
    `Still hold: ${labels("held")}. Did not hold: ${labels("broke")}. ` +
    `Missing: ${labels("missing")}. ${reason.trim()}`
  );
}
