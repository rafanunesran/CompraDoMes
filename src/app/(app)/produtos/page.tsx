"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useHouseholdId } from "@/components/household";
import { Empty, ErrorBox, Input, Loading, PageHeader } from "@/components/ui";
import { categoryOrder } from "@/lib/categories";
import { pricesByProduct } from "@/lib/compare";
import { fetchLatestPrices, fetchProducts, fetchStores } from "@/lib/db";
import { brl } from "@/lib/format";
import type { LatestPrice, Product, Store } from "@/lib/types";
import { perUnitLabel } from "@/lib/units";

export default function ProductsPage() {
  const hid = useHouseholdId();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [prices, setPrices] = useState<Map<string, LatestPrice[]>>(new Map());
  const [stores, setStores] = useState<Map<string, Store>>(new Map());
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchProducts(hid), fetchLatestPrices(hid), fetchStores(hid)])
      .then(([p, lp, s]) => {
        setProducts(p);
        setPrices(pricesByProduct(lp));
        setStores(new Map(s.map((x) => [x.id, x])));
      })
      .catch((e: Error) => setError(e.message));
  }, [hid]);

  const groups = useMemo(() => {
    const q = query
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    const visible = (products ?? []).filter((p) =>
      p.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .includes(q),
    );
    const map = new Map<string, Product[]>();
    for (const p of visible) map.set(p.category, [...(map.get(p.category) ?? []), p]);
    return [...map.entries()].sort(([a], [b]) => categoryOrder(a) - categoryOrder(b));
  }, [products, query]);

  if (error) return <ErrorBox message={error} />;
  if (!products) return <Loading />;

  return (
    <>
      <PageHeader title="Preços" subtitle="Compare cada produto entre os mercados" />
      <Input placeholder="Buscar produto…" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-4" />
      {products.length === 0 && <Empty>Os produtos aparecem aqui quando você adiciona itens na lista.</Empty>}
      <div className="flex flex-col gap-4">
        {groups.map(([cat, list]) => (
          <section key={cat}>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{cat}</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
              {list.map((p) => {
                const ps = prices.get(p.id) ?? [];
                const best = ps[0];
                const worst = ps[ps.length - 1];
                return (
                  <li key={p.id}>
                    <Link href={`/produtos/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block truncate">{p.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {best
                            ? `${ps.length} ${ps.length === 1 ? "mercado" : "mercados"} · melhor no ${stores.get(best.store_id)?.name}`
                            : "sem preço ainda"}
                        </span>
                      </span>
                      {best && (
                        <span className="text-right">
                          <span className="block font-semibold text-accent">
                            {brl(best.unit_price_normalized ?? best.price)}
                            <span className="text-xs font-normal">{perUnitLabel(p.base_unit)}</span>
                          </span>
                          {ps.length > 1 && (
                            <span className="block text-xs text-muted">
                              até {brl(worst.unit_price_normalized ?? worst.price)}
                            </span>
                          )}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
