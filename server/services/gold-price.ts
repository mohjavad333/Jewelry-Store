import { RequestHandler } from "express";
import { GoldPriceSnapshot } from "@shared/gold";

const nerkhEndpoint = "https://api.nerkh.io/v2/prices/json/gold/GOLD18K";
const talaseaEndpoint = "https://api.talasea.ir/api/market/getGoldPrice";
const PRICE_TIMEOUT_MS = 6_000;
let snapshot: GoldPriceSnapshot = {
  pricePerGram18k: 3_520_000,
  updatedAt: new Date().toISOString(),
  changePercent: 0,
  source: "fallback",
};
let lastExternalFetch = 0;
let refreshPromise: Promise<GoldPriceSnapshot> | null = null;

function parsePrice(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePercent(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchNerkhSnapshot() {
  const token = process.env.NERKH_API_TOKEN;
  const apiKey = process.env.NERKH_API_KEY;
  if (!token && !apiKey) throw new Error("Nerkh credentials are not configured");
  const url = apiKey ? `${nerkhEndpoint}?x-api-key=${encodeURIComponent(apiKey)}` : nerkhEndpoint;
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(PRICE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Nerkh API returned ${response.status}`);
  const body = await response.json() as { data?: { prices?: { current?: unknown; ch_24h_percent?: unknown; update?: string } } };
  const price = parsePrice(body.data?.prices?.current);
  if (!price) throw new Error("Nerkh response did not include a valid GOLD18K current price");
  return {
    pricePerGram18k: price,
    updatedAt: body.data?.prices?.update ?? new Date().toISOString(),
    changePercent: parsePercent(body.data?.prices?.ch_24h_percent),
    source: "nerkh" as const,
  };
}

async function fetchTalaseaSnapshot() {
  const response = await fetch(talaseaEndpoint, {
    headers: { Accept: "application/json", Referer: "https://talasea.ir", Origin: "https://talasea.ir" },
    signal: AbortSignal.timeout(PRICE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Talasea API returned ${response.status}`);
  const body = await response.json() as { price?: unknown; change24h?: unknown };
  const upstreamPrice = parsePrice(body.price);
  if (!upstreamPrice) throw new Error("Talasea response did not include a valid price");
  return {
    pricePerGram18k: Math.round(upstreamPrice * 1_000),
    updatedAt: new Date().toISOString(),
    changePercent: parsePercent(body.change24h),
    source: "talasea" as const,
  };
}

async function refreshSnapshot() {
  if (Date.now() - lastExternalFetch < 7_000) return snapshot;
  if (refreshPromise) return refreshPromise;
  lastExternalFetch = Date.now();
  refreshPromise = (async () => {
    const [nerkhResult, talaseaResult] = await Promise.allSettled([
      fetchNerkhSnapshot(),
      fetchTalaseaSnapshot(),
    ]);
    if (nerkhResult.status === "fulfilled") {
      snapshot = nerkhResult.value;
    } else {
      console.error("Nerkh price refresh failed; trying Talasea", nerkhResult.reason);
      if (talaseaResult.status === "fulfilled") {
        snapshot = talaseaResult.value;
      } else {
        console.error("Talasea price refresh failed; keeping last known price", talaseaResult.reason);
      }
    }
    return snapshot;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function getGoldPriceSnapshot() {
  return refreshSnapshot();
}
