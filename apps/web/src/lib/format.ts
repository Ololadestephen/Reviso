import type { Metric, NarrativeStance, State } from "../api/schemas";

/** Research-honesty sentence kept for Guide and exports, not the result page. */
export const TRUST_LINE =
  "Reviso does not invent a metric, treat an older report as a successful current check, or let an explanation overwrite the comparison. Market price is not used in this result.";

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

/** Plain finding label. Status cannot rely on color alone. */
export function findingLabel(state: State) {
  if (state === "SUPPORTED") return "Supported";
  if (state === "CHALLENGED") return "Needs attention";
  if (state === "INVALIDATED") return "Did not hold";
  return "Not enough evidence";
}

/** Condition-table status. Overall badges keep findingLabel. */
export function conditionStatusLabel(state: State) {
  if (state === "SUPPORTED") return "Supported";
  if (state === "CHALLENGED") return "Challenged";
  if (state === "INVALIDATED") return "Did not hold";
  return "Missing";
}

export function resultHeadline(state: State) {
  if (state === "SUPPORTED") return "This filing supports your idea";
  if (state === "CHALLENGED") return "This filing needs a closer look";
  if (state === "INVALIDATED") return "This filing does not support your idea";
  return "This filing is not enough to check your idea";
}

/** One-line result: what held, what broke, what is still missing. */
export function resultTally(
  state: State,
  assumptions: { state: State }[],
): string {
  if (!assumptions.length) return resultHeadline(state);
  const supported = assumptions.filter(
    (item) => item.state === "SUPPORTED",
  ).length;
  const failed = assumptions.filter(
    (item) => item.state === "INVALIDATED",
  ).length;
  const missing = assumptions.filter(
    (item) =>
      item.state === "INSUFFICIENT_EVIDENCE" || item.state === "CHALLENGED",
  ).length;
  const parts: string[] = [];
  if (supported) {
    parts.push(
      supported === 1
        ? "1 condition supported"
        : `${supported} conditions supported`,
    );
  }
  if (failed) {
    parts.push(failed === 1 ? "1 did not hold" : `${failed} did not hold`);
  }
  if (missing) {
    parts.push(
      missing === 1 ? "1 needs more evidence" : `${missing} need more evidence`,
    );
  }
  return parts.join(" · ") || resultHeadline(state);
}

export function resultLead(assessment: {
  state: State;
  assumptions: { state: State }[];
  next_question: string;
}) {
  const total = assessment.assumptions.length;
  const checked = assessment.assumptions.filter(
    (item) => item.state !== "INSUFFICIENT_EVIDENCE",
  ).length;
  const missing = total - checked;
  const counts =
    total > 0 && missing > 0 && checked > 0
      ? ` ${checked} condition${checked === 1 ? " has" : "s have"} a number in this filing. ${missing} still ${missing === 1 ? "does" : "do"} not.`
      : "";
  if (assessment.state === "INVALIDATED") {
    return `A condition you said would change your mind did not hold in this report.${counts}`;
  }
  if (assessment.state === "INSUFFICIENT_EVIDENCE") {
    return `This report does not include the numbers needed to check one or more required conditions.${counts}`;
  }
  if (assessment.state === "CHALLENGED") {
    return `At least one required condition looks weaker than you asked for. Read it before you decide.${counts}`;
  }
  if (!total) return assessment.next_question;
  if (missing === total) {
    return "None of your conditions have a reported number in this filing yet.";
  }
  return "The numbers in this report still match the conditions you confirmed.";
}

/** Engine placeholders are not gaps a visitor can act on. */
export function humanGaps(items: string[]): string[] {
  const seen = new Set<string>();
  const gaps: string[] = [];
  for (const item of items) {
    if (item.includes("Narrative AI review")) continue;
    let text = item;
    if (item.includes("share reference") || item.includes("unit ratio")) {
      text =
        "Reviso cannot compare this token price with the listed share price.";
    } else if (item.includes("Token terms") || item.includes("redemption")) {
      text =
        "Whether you can redeem the token for shares is not part of this check.";
    } else if (item.includes("no older report substituted")) {
      text =
        "The latest filing could not be loaded. An older report was not used instead.";
    }
    if (seen.has(text)) continue;
    seen.add(text);
    gaps.push(text);
  }
  return gaps;
}

export function isGeneralLimitation(text: string) {
  return text.includes("token price") || text.includes("redeem the token");
}

export function aiHelpCopy(configured: boolean, hasEvidence: boolean) {
  if (!configured) {
    return "Qwen is not connected on this app, so it cannot explain the filing. You can still read the numbers and record a decision.";
  }
  if (!hasEvidence) {
    return "Load a filing first. Qwen can then explain this check; it cannot change the result.";
  }
  return "Qwen reads your conditions and this filing only. Its explanation cannot change the result.";
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

export function followUpReady(status: {
  configured: boolean;
  chat_configured?: boolean;
}) {
  return status.chat_configured ?? status.configured;
}

export function draftReady(status: {
  configured: boolean;
  draft_configured?: boolean;
}) {
  return status.draft_configured ?? status.configured;
}

/**
 * Must stay byte-identical to `canonical_invalidation` in backend/contracts.py.
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
