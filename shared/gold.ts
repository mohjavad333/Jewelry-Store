export type GoldPriceSnapshot = {
  pricePerGram18k: number;
  updatedAt: string;
  changePercent: number;
  source: "nerkh" | "talasea" | "fallback";
};

export type GoldPricingInput = {
  weight: number;
  karat: number;
  makingRate?: number;
  profitRate?: number;
  taxRate?: number;
};

export function calculateGoldPricing(snapshot: GoldPriceSnapshot, input: GoldPricingInput) {
  const makingRate = input.makingRate ?? 0.12;
  const profitRate = input.profitRate ?? 0.07;
  const taxRate = input.taxRate ?? 0.1;
  const rawGold = Math.round(input.weight * snapshot.pricePerGram18k * (input.karat / 18));
  const making = Math.round(rawGold * makingRate);
  const profit = Math.round((rawGold + making) * profitRate);
  const tax = Math.round((making + profit) * taxRate);
  return { rawGold, making, profit, tax, total: rawGold + making + profit + tax };
}

export function calculateCustomizationCost(customization?: string) {
  if (!customization) return 0;
  return (
    (customization.includes("حکاکی") ? 500_000 : 0) +
    (customization.includes("بسته‌بندی هدیه") ? 150_000 : 0) +
    (customization.includes("نگین زیرکونیا") ? 850_000 : 0) +
    (customization.includes("الماس آزمایشگاهی") ? 3_500_000 : 0)
  );
}
