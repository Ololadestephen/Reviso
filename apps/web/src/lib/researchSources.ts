import type { Assessment, Evidence } from "../api/schemas";

export function researchSources(check: Assessment): Evidence[] {
  return [...check.evidence, ...(check.research_sources ?? [])];
}

export function sourceKindLabel(source: Evidence): string {
  switch (source.kind) {
    case "COMPANY_REPORT":
      return "Company report";
    case "MONETARY_POLICY":
      return "Fed policy";
    case "ECONOMIC_DATA":
      return "Inflation and jobs";
    default:
      return "Company figures";
  }
}
