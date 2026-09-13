import {
  loadConfig,
  buildTools,
  BitgetRestClient,
  safeInvoke,
} from "@bitget-ai/bitget-agent-sdk";

const config = loadConfig({
  modules: "market",
  readOnly: true,
  baseUrl: "https://api.bitget.com",
  timeoutMs: 8000,
});
const client = new BitgetRestClient(config);
const market = buildTools(config).find((tool) => tool.name === "market");
if (!market) throw new Error("SDK market interface unavailable");
const allowedSymbols = new Set([
  "RNVDAUSDT",
  "RAAPLUSDT",
  "RMSFTUSDT",
  "RGOOGLUSDT",
  "RAMZNUSDT",
  "RTSLAUSDT",
]);
const symbol = process.argv[2];
if (!allowedSymbols.has(symbol))
  throw new Error("Instrument is outside the allowlist");
const [ticker, book, instrument] = await Promise.all(
  ["tickers", "orderbook", "instruments"].map((action) =>
    safeInvoke(
      market,
      {
        action,
        category: "SPOT",
        symbol,
        ...(action === "orderbook" ? { limit: "50" } : {}),
        view: "full",
      },
      { config, client },
    ),
  ),
);
console.log(
  JSON.stringify({
    instrument_id: symbol,
    source: "https://api.bitget.com",
    availability: ticker.ok ? "AVAILABLE" : "UNAVAILABLE",
    observed_at: null,
    ticker: ticker.ok ? ticker : null,
    book: book.ok ? book : null,
    instrument: instrument.ok ? instrument : null,
    warnings: [
      "Public SDK observation; verify symbol and source timestamp. No share-reference conversion.",
      ...(ticker.ok ? [] : ["Bitget public ticker request failed."]),
      ...(book.ok ? [] : ["Bitget visible book unavailable."]),
    ],
  }),
);
