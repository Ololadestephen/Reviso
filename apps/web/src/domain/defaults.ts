import {
  thesisInputSchema,
  type Assumption,
  type InstrumentId,
  type ThesisInput,
} from "../api/schemas";

export type EditableThesis = Omit<
  ThesisInput,
  "instrument_id" | "holding_days"
> & {
  instrument_id: InstrumentId | "";
  holding_days: number | "";
};

export function emptyThesis(): EditableThesis {
  return {
    instrument_id: "",
    direction: "long",
    proposed_amount: "",
    entry_price: "",
    max_loss: "",
    // Keep the collapsed advanced control valid while exposing its value again
    // in the confirmation summary before anything can be confirmed.
    max_slippage_bps: "100",
    holding_days: "",
    rationale: "",
    assumptions: [],
  };
}

export function manualStarter(): Assumption {
  return {
    id: "claim-1",
    claim: "",
    category: "fundamental",
    essential: true,
    metric: "manual",
    minimum: "0",
    invalidation_condition:
      "Requires manual evidence review; no numerical invalidation rule.",
  };
}

export function fromThesisInput(thesis: ThesisInput): EditableThesis {
  return structuredClone(thesis);
}

export function validateThesis(draft: EditableThesis) {
  return thesisInputSchema.safeParse({
    ...draft,
    holding_days:
      draft.holding_days === "" ? Number.NaN : Number(draft.holding_days),
  });
}

/**
 * The worked NVIDIA example the workbench opens with. Every value is an
 * illustration, not a recommendation or a quote.
 */
export const defaultThesis: ThesisInput = {
  instrument_id: "RNVDAUSDT",
  direction: "long",
  proposed_amount: "10000",
  entry_price: "100",
  max_loss: "1000",
  max_slippage_bps: "100",
  holding_days: 90,
  rationale:
    "I want 10,000 USDT of rNVDA for 90 days because NVIDIA can sustain strong revenue growth and a GAAP gross margin of at least 75%.",
  assumptions: [
    {
      id: "margin",
      claim: "Reported GAAP gross margin stays at or above 75%.",
      category: "fundamental",
      essential: true,
      metric: "gaap_margin_pct",
      minimum: "75",
      invalidation_condition:
        "Invalidate when reported GAAP gross margin is below 75%.",
    },
    {
      id: "growth",
      claim: "Reported year-over-year revenue growth stays at or above 80%.",
      category: "fundamental",
      essential: true,
      metric: "revenue_growth_yoy_pct",
      minimum: "80",
      invalidation_condition:
        "Invalidate when reported year-over-year revenue growth is below 80%.",
    },
  ],
};
