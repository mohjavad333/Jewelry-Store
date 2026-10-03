import { useEffect, useState } from "react";
import { GoldPriceSnapshot } from "@shared/gold";

const initialSnapshot: GoldPriceSnapshot = { pricePerGram18k: 3_520_000, updatedAt: "", changePercent: 0, source: "fallback" };

export function useGoldPrice() {
  const [snapshot, setSnapshot] = useState<GoldPriceSnapshot>(initialSnapshot);
  const [stale, setStale] = useState(true);

  useEffect(() => {
    const apply = (next: GoldPriceSnapshot) => {
      if (!Number.isFinite(next.pricePerGram18k) || !next.updatedAt) return;
      setSnapshot(next);
      setStale(next.source === "fallback");
    };
    let active = true;
    const refresh = () => {
      fetch("/api/gold-price")
        .then((response) => {
          if (!response.ok) throw new Error("gold-price-request-failed");
          return response.json() as Promise<GoldPriceSnapshot>;
        })
        .then((next) => { if (active) apply(next); })
        .catch(() => { if (active) setStale(true); });
    };
    refresh();
    const interval = window.setInterval(refresh, 15_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  return { ...snapshot, stale };
}
