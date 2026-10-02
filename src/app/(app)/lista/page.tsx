"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHouseholdId } from "@/components/household";
import { ProductPicker, type PickedProduct } from "@/components/product-picker";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui";
import { categoryOrder } from "@/lib/categories";
import { bestPriceByProduct, bestSplitTotal, estimateByStore } from "@/lib/compare";
import {
  addToList,
  fetchLatestPrices,
  fetchListItems,
  fetchProducts,
  fetchStores,
  findOrCreateProduct,
  getOrCreateList,
  must,
  setListItemChecked,
} from "@/lib/db";
import { brl, formatQty, monthKey, monthLabel, shiftMonth } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { LatestPrice, ListItem, Product, ShoppingList, Store } from "@/lib/types";
import { perUnitLabel } from "@/lib/units";

export default function ListaPage() {
  const hid = useHouseholdId();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [prices, setPrices] = useState<LatestPrice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todos" | "faltam">("todos");

  const refreshItems = useCallback(async (listId: string) => {
    setItems(await fetchListItems(listId));
  }, []);

  useEffect(() => {
    (async () => {
      const l = await getOrCreateList(hid, monthKey());
      setList(l);
      const [it, pr, st, lp] = await Promise.all([
        fetchListItems(l.id),
        fetchProducts(hid),
        fetchStores(hid),
        fetchLatestPrices(hid),
      ]);
      setItems(it);
      setProducts(pr);
      setStores(st);
      setPrices(lp);
    })().catch((e: Error) => setError(e.message));
  }, [hid]);

  // Atualiza quando outra pessoa da casa mexe na lista.
  useEffect(() => {
    if (!list) return;
    const channel = supabase()
      .channel(`list-${list.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "list_items", filter: `list_id=eq.${list.id}` },
        () => void refreshItems(list.id),
      )
      .subscribe();
    return () => {
      void supabase().removeChannel(channel);
    };
  }, [list, refreshItems]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const best = useMemo(() => bestPriceByProduct(prices), [prices]);

  const pending = items.filter((i) => !i.checked);
  const estimates = useMemo(() => estimateByStore(pending, prices), [pending, prices]);
  const split = useMemo(() => bestSplitTotal(pending, prices), [pending, prices]);

  const groups = useMemo(() => {
    const visible = filter === "faltam" ? items.filter((i) => !i.checked) : items;
    const map = new Map<string, ListItem[]>();
    for (const it of visible) {
      const cat = productById.get(it.product_id)?.category ?? "Outros";
      map.set(cat, [...(map.get(cat) ?? []), it]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => categoryOrder(a) - categoryOrder(b))
      .map(([cat, its]) => [
        cat,
        its.sort(
          (a, b) =>
            Number(a.checked) - Number(b.checked) ||
            (productById.get(a.product_id)?.name ?? "").localeCompare(productById.get(b.product_id)?.name ?? ""),
        ),
      ] as const);
  }, [items, filter, productById]);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      if (list) await refreshItems(list.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function add(p: PickedProduct) {
    if (!list) return;
    await run(async () => {
      const product = await findOrCreateProduct(hid, p.name, p.category, p.baseUnit, products);
      if (!p.existing) setProducts(await fetchProducts(hid));
      await addToList(hid, list.id, product.id, p.quantity);
    });
  }

  async function copyPreviousMonth() {
    if (!list) return;
    await run(async () => {
      const prev = must(
        await supabase()
          .from("shopping_lists")
          .select("id")
          .eq("household_id", hid)
          .eq("month", shiftMonth(list.month, -1))
          .maybeSingle(),
      ) as { id: string } | null;
      if (!prev) throw new Error("Não há lista no mês anterior.");
      const prevItems = await fetchListItems(prev.id);
      const already = new Set(items.map((i) => i.product_id));
      const rows = prevItems
        .filter((i) => !already.has(i.product_id))
        .map((i) => ({ household_id: hid, list_id: list.id, product_id: i.product_id, quantity: i.quantity, note: i.note }));
      if (rows.length) must(await supabase().from("list_items").insert(rows));
    });
  }

  if (!list) return error ? <ErrorBox message={error} /> : <Loading />;

  return (
    <>
      <PageHeader
        title="Lista do mês"
        subtitle={`${monthLabel(list.month)} · ${items.length - pending.length} de ${items.length} comprados`}
      />

      <Card className="mb-4">
        <ProductPicker products={products} onPick={add} />
      </Card>
      <ErrorBox message={error} />

      {items.length === 0 ? (
        <Empty>
          <p className="mb-3">Sua lista está vazia.</p>
          <Button variant="secondary" onClick={copyPreviousMonth}>
            Copiar lista do mês passado
          </Button>
        </Empty>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-1 rounded-xl bg-surface p-1 text-sm">
              {(["todos", "faltam"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1 ${filter === f ? "bg-accent text-white" : "text-muted"}`}
                >
                  {f === "todos" ? "Todos" : `Faltam (${pending.length})`}
                </button>
              ))}
            </div>
            <button onClick={copyPreviousMonth} className="text-sm text-accent">
              + mês passado
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {groups.map(([cat, its]) => (
              <section key={cat}>
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{cat}</h2>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
                  {its.map((it) => {
                    const product = productById.get(it.product_id);
                    const bp = best.get(it.product_id);
                    return (
                      <li key={it.id} className="flex items-center gap-3 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={it.checked}
                          onChange={(e) => run(() => setListItemChecked(it.id, e.target.checked))}
                          className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                          aria-label={`Marcar ${product?.name}`}
                        />
                        <Link href={`/produtos/${it.product_id}`} className="min-w-0 flex-1">
                          <span className={`block truncate ${it.checked ? "text-muted line-through" : ""}`}>
                            {product?.name}
                          </span>
                          {bp && !it.checked && (
                            <span className="block truncate text-xs text-muted">
                              Melhor: {brl(bp.unit_price_normalized ?? bp.price)}
                              {product && perUnitLabel(product.base_unit)} no {storeById.get(bp.store_id)?.name}
                            </span>
                          )}
                        </Link>
                        <div className="flex items-center gap-1">
                          <button
                            className="h-8 w-8 rounded-full border border-border text-lg leading-none"
                            aria-label="Diminuir"
                            onClick={() =>
                              run(async () => {
                                if (Number(it.quantity) <= 1) {
                                  must(await supabase().from("list_items").delete().eq("id", it.id));
                                } else {
                                  must(
                                    await supabase()
                                      .from("list_items")
                                      .update({ quantity: Number(it.quantity) - 1 })
                                      .eq("id", it.id),
                                  );
                                }
                              })
                            }
                          >
                            {Number(it.quantity) <= 1 ? "×" : "−"}
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{formatQty(Number(it.quantity))}</span>
                          <button
                            className="h-8 w-8 rounded-full border border-border text-lg leading-none"
                            aria-label="Aumentar"
                            onClick={() =>
                              run(async () =>
                                must(
                                  await supabase()
                                    .from("list_items")
                                    .update({ quantity: Number(it.quantity) + 1 })
                                    .eq("id", it.id),
                                ),
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {estimates.length > 0 && (
            <Card className="mt-6">
              <h2 className="mb-1 font-semibold">Onde comprar o que falta</h2>
              <p className="mb-3 text-xs text-muted">Estimativa com o último preço conhecido de cada mercado.</p>
              <ul className="flex flex-col gap-2 text-sm">
                {estimates.map((e) => (
                  <li key={e.store_id} className="flex justify-between">
                    <span>
                      {storeById.get(e.store_id)?.name}
                      <span className="block text-xs text-muted">
                        {e.covered} de {pending.length} itens com preço
                      </span>
                    </span>
                    <span className="font-semibold">{brl(e.total)}</span>
                  </li>
                ))}
                {estimates.length > 1 && (
                  <li className="flex justify-between border-t border-border pt-2 text-accent">
                    <span>
                      Cada item no mais barato
                      <span className="block text-xs">{split.covered} itens com preço</span>
                    </span>
                    <span className="font-semibold">{brl(split.total)}</span>
                  </li>
                )}
              </ul>
            </Card>
          )}
        </>
      )}
    </>
  );
}
