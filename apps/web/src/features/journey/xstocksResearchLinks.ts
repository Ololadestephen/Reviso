import type { Instrument } from "../../api/schemas";

interface ResearchLink {
  id: string;
  label: string;
  url: string;
  publishedOn: string;
  companies: readonly Instrument["id"][];
  marketWide: boolean;
}

export const researchLinksCheckedOn = "2026-10-04";
export const xstocksResearchIndex = "https://xstocks.fi/news";
const millisecondsPerDay = 24 * 60 * 60 * 1000;

// Manually checked links and our own topic labels, not copied article content.
// No website requests, previews, PDFs or model context are created from this list.
const links: readonly ResearchLink[] = [
  {
    id: "2026-09-29-tesla",
    label: "Interest rates and Tesla delivery dates",
    url: "https://xstocks.fi/news/us-10-year-yields-top-5-as-micron-earnings-and-tesla-deliveries-set-the-tone-for-growth-equities",
    publishedOn: "2026-09-29",
    companies: ["RTSLAUSDT"],
    marketWide: false,
  },
  {
    id: "2026-09-22-market",
    label: "Interest rates and geopolitical risks",
    url: "https://xstocks.fi/news/investors-eye-geopolitical-tensions-as-the-fed-raises-rates",
    publishedOn: "2026-09-22",
    companies: [],
    marketWide: true,
  },
  {
    id: "2026-09-15-market",
    label: "Rates and AI-sector uncertainty",
    url: "https://xstocks.fi/news/investors-weigh-the-fomc-decision-as-geopolitical-tension-and-ai-development-slowdown-risks-collide",
    publishedOn: "2026-09-15",
    companies: [],
    marketWide: true,
  },
  {
    id: "2026-09-08-apple",
    label: "Inflation, jobs and Apple's product event",
    url: "https://xstocks.fi/news/investors-await-critical-cpi-report-after-hot-jobs-report",
    publishedOn: "2026-09-08",
    companies: ["RAAPLUSDT"],
    marketWide: false,
  },
];

export function researchLinksFor(
  instrumentId: Instrument["id"],
  evidenceCutoff: string,
) {
  const cutoff = Date.parse(evidenceCutoff);
  if (!Number.isFinite(cutoff)) return [];
  return links
    .filter((link) => {
      // A date-only publication is conservatively available next UTC day.
      const availableAt =
        Date.parse(`${link.publishedOn}T00:00:00Z`) + millisecondsPerDay;
      return (
        availableAt <= cutoff &&
        (link.marketWide || link.companies.includes(instrumentId))
      );
    })
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
}
