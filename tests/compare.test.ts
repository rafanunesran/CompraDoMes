import { describe, expect, it } from "vitest";
import { bestPriceByProduct, bestSplitTotal, estimateByStore } from "@/lib/compare";
import type { LatestPrice } from "@/lib/types";

function price(product_id: string, store_id: string, price: number, norm?: number): LatestPrice {
  return {
    product_id,
    store_id,
    price,
    unit_price_normalized: norm ?? price,
    sku_id: null,
    package_qty: null,
    package_unit: null,
    observed_at: "2026-10-01T00:00:00Z",
    source: "purchase",
  };
}

const latest = [
  price("arroz", "A", 25, 5),
  price("arroz", "B", 6, 6), // pacote de 1kg: mais barato no total, mais caro por kg
  price("leite", "A", 5),
  price("leite", "B", 4.5),
  price("cafe", "A", 18),
];

describe("bestPriceByProduct", () => {
  it("compara pelo preço normalizado", () => {
    const best = bestPriceByProduct(latest);
    expect(best.get("arroz")?.store_id).toBe("A");
    expect(best.get("leite")?.store_id).toBe("B");
  });
});

describe("estimateByStore", () => {
  const items = [
    { product_id: "arroz", quantity: 1 },
    { product_id: "leite", quantity: 12 },
    { product_id: "cafe", quantity: 2 },
  ];
  it("soma por mercado e ordena por cobertura", () => {
    const est = estimateByStore(items, latest);
    expect(est[0]).toEqual({ store_id: "A", total: 25 + 60 + 36, covered: 3, missing: 0 });
    expect(est[1]).toEqual({ store_id: "B", total: 6 + 54, covered: 2, missing: 1 });
  });
  it("calcula o total dividindo entre mercados", () => {
    expect(bestSplitTotal(items, latest)).toEqual({ total: 25 + 54 + 36, covered: 3 });
  });
});
