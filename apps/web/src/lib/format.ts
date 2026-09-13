import type { Metric, NarrativeStance, State } from "../api/schemas";

/** Absent observations must never render as zero. */
export function money(value: string | null | undefined) {
  return value === null || value === undefined
    ? "Unavailable"
    : Number(value).toLocaleString("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
}

export function stateLabel(state: State | NarrativeStance) {
  return state.toLowerCase().replaceAll("_", " ");
}

/** First sentence of an idea, clipped for lists. Never invents a title. */
export function ideaTitle(rationale: string, limit = 72): string {
  const compact = rationale.replace(/\s+/g, " ").trim();
  if (!compact) return "Untitled idea";
  const sentence = compact.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? compact;
  const core = sentence.replace(/[.!?]+$/, "");
  if (core.length <= limit) return core;
  const clipped = core
    .slice(0, limit)
    .replace(/\s+\S*$/, "")
    .replace(/[,:;–-]+$/, "");
  return `${clipped || core.slice(0, limit)}…`;
}

export function llmProviderLabel(provider: string) {
  if (provider === "bitget-qwen") return "Bitget Qwen";
  if (provider === "groq") return "Groq";
  return provider;
}

/**
 * Must stay byte-identical to `Assumption.consistent_condition` in
 * backend/contracts.py, which rejects any other wording for a known metric.
 */
export function conditionText(metric: Metric, minimum: string) {
  if (metric === "manual")
    return "Requires manual evidence review; no numerical invalidation rule.";
  const label =
    metric === "gaap_margin_pct"
      ? "GAAP gross margin"
      : "year-over-year revenue growth";
  return `Invalidate when reported ${label} is below ${Number(minimum)}%.`;
}

export function timeLabel(value: string) {
  return new Date(value).toLocaleString();
}
