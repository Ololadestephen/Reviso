import type { InstrumentId } from "../../api/schemas";

export type IdeaExample = {
  label: string;
  text: string;
};

/**
 * Starting points for the idea box. They are not the user's own words and
 * must not be saved or confirmed automatically.
 */
export const ideaExamples: Record<InstrumentId, readonly IdeaExample[]> = {
  RNVDAUSDT: [
    {
      label: "Data-centre demand stays strong",
      text: "I think NVIDIA's data-centre demand can remain strong. I would reconsider if reported year-over-year revenue growth turned negative.",
    },
    {
      label: "Reported margin stays high",
      text: "I want to research NVIDIA while reported GAAP gross margin stays high. A clear drop in that margin would make me reconsider.",
    },
  ],
  RAAPLUSDT: [
    {
      label: "The business keeps growing",
      text: "I think Apple can keep growing. I would reconsider if reported year-over-year revenue growth turned negative.",
    },
    {
      label: "Reported margin stays high",
      text: "I want to research Apple while reported GAAP gross margin stays high. A clear drop in that margin would make me reconsider.",
    },
  ],
  RMSFTUSDT: [
    {
      label: "Cloud demand stays strong",
      text: "I think Microsoft’s cloud demand can remain strong. I would reconsider if reported year-over-year revenue growth turned negative.",
    },
    {
      label: "Reported margin stays high",
      text: "I want to research Microsoft while reported GAAP gross margin stays high. A clear drop in that margin would make me reconsider.",
    },
  ],
  RGOOGLUSDT: [
    {
      label: "Advertising demand keeps growing",
      text: "I think Alphabet can keep growing while advertising demand remains healthy. I would reconsider if reported year-over-year revenue growth turned negative.",
    },
    {
      label: "AI products create durable demand",
      text: "I think Alphabet's AI products can create durable demand. I would reconsider if customers do not adopt them widely enough to strengthen the business.",
    },
  ],
  RAMZNUSDT: [
    {
      label: "The business keeps growing",
      text: "I think Amazon can keep growing across commerce and cloud services. I would reconsider if reported year-over-year revenue growth turned negative.",
    },
    {
      label: "Cloud demand stays healthy",
      text: "I think demand for Amazon's cloud services can remain healthy. I would reconsider if customers reduce cloud spending or competitors weaken its position.",
    },
  ],
  RTSLAUSDT: [
    {
      label: "Demand supports growth",
      text: "I think demand for Tesla's products can support continued growth. I would reconsider if reported year-over-year revenue growth turned negative.",
    },
    {
      label: "Reported margin recovers",
      text: "I want to research Tesla while reported GAAP gross margin remains resilient. A clear drop in that margin would make me reconsider.",
    },
  ],
};

export function examplesFor(instrumentId: string): readonly IdeaExample[] {
  return instrumentId in ideaExamples
    ? ideaExamples[instrumentId as InstrumentId]
    : [];
}
