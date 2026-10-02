import type { LatestPrice } from "./types";

/** Valor usado para comparar: preço normalizado (por kg/L/un) quando existe. */
export function comparableValue(p: Pick<LatestPrice, "price" | "unit_price_normalized">): number {
  return p.unit_price_normalized ?? p.price;
}

/** Último preço mais barato de cada produto, considerando todos os mercados. */
export function bestPriceByProduct(latest: LatestPrice[]): Map<string, LatestPrice> {
  const best = new Map<string, LatestPrice>();
  for (const p of latest) {
    const cur = best.get(p.product_id);
    if (!cur || comparableValue(p) < comparableValue(cur)) best.set(p.product_id, p);
  }
  return best;
}

export function pricesByProduct(latest: LatestPrice[]): Map<string, LatestPrice[]> {
  const map = new Map<string, LatestPrice[]>();
  for (const p of latest) {
    const arr = map.get(p.product_id) ?? [];
    arr.push(p);
    map.set(p.product_id, arr);
  }
  for (const arr of map.values()) arr.sort((a, b) => comparableValue(a) - comparableValue(b));
  return map;
}

export interface StoreEstimate {
  store_id: string;
  total: number;
  covered: number;
  missing: number;
}

/**
 * Quanto a lista custaria em cada mercado, usando o último preço conhecido.
 * `covered` diz quantos itens da lista têm preço naquele mercado.
 */
export function estimateByStore(
  items: { product_id: string; quantity: number }[],
  latest: LatestPrice[],
): StoreEstimate[] {
  const byStore = new Map<string, Map<string, LatestPrice>>();
  for (const p of latest) {
    const m = byStore.get(p.store_id) ?? new Map<string, LatestPrice>();
    m.set(p.product_id, p);
    byStore.set(p.store_id, m);
  }
  const result: StoreEstimate[] = [];
  for (const [store_id, prices] of byStore) {
    let total = 0;
    let covered = 0;
    for (const it of items) {
      const p = prices.get(it.product_id);
      if (p) {
        total += p.price * it.quantity;
        covered++;
      }
    }
    if (covered > 0) result.push({ store_id, total, covered, missing: items.length - covered });
  }
  return result.sort((a, b) => b.covered - a.covered || a.total - b.total);
}

/** Total comprando cada item no mercado onde ele está mais barato. */
export function bestSplitTotal(
  items: { product_id: string; quantity: number }[],
  latest: LatestPrice[],
): { total: number; covered: number } {
  const best = bestPriceByProduct(latest);
  let total = 0;
  let covered = 0;
  for (const it of items) {
    const p = best.get(it.product_id);
    if (p) {
      total += p.price * it.quantity;
      covered++;
    }
  }
  return { total, covered };
}
