"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHouseholdId } from "@/components/household";
import { PriceForm, type PriceFormValues } from "@/components/price-form";
import { ProductPicker, type PickedProduct } from "@/components/product-picker";
import { Button, Empty, ErrorBox, Loading, Sheet } from "@/components/ui";
import { categoryOrder } from "@/lib/categories";
import { pricesByProduct } from "@/lib/compare";
import {
  fetchLatestPrices,
  fetchListItems,
  fetchProducts,
  findOrCreateProduct,
  findOrCreateSku,
  must,
  setListItemChecked,
} from "@/lib/db";
import { brl, formatQty } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { LatestPrice, ListItem, Product, Purchase, PurchaseItem, Sku, Store } from "@/lib/types";
import { packageLabel } from "@/lib/units";

type Editing =
  | { kind: "list"; item: ListItem; product: Product }
  | { kind: "cart"; item: PurchaseItem; product: Product }
  | { kind: "extra" }
  | { kind: "extra-price"; product: Product };

export default function ShoppingModePage() {
  const { id } = useParams<{ id: string }>();
  const hid = useHouseholdId();
  const router = useRouter();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Map<string, Store>>(new Map());
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [skus, setSkus] = useState<Map<string, Sku>>(new Map());
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<LatestPrice[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (p: Purchase) => {
    const db = supabase();
    const [items, cartRows] = await Promise.all([
      p.list_id ? fetchListItems(p.list_id) : Promise.resolve([]),
      db.from("purchase_items").select("*").eq("purchase_id", p.id).order("created_at", { ascending: false }).then(must),
    ]);
    const cartItems = cartRows as PurchaseItem[];
    setListItems(items);
    setCart(cartItems);
    const skuIds = [...new Set(cartItems.map((c) => c.sku_id).filter(Boolean))] as string[];
    if (skuIds.length) {
      const rows = must(await db.from("skus").select("*").in("id", skuIds)) as Sku[];
      setSkus(new Map(rows.map((s) => [s.id, s])));
    }
  }, []);

  useEffect(() => {
    (async () => {
      const db = supabase();
      const p = must(await db.from("purchases").select("*").eq("id", id).single()) as Purchase;
      if (p.status === "done") {
        router.replace(`/historico/${p.id}`);
        return;
      }
      const [allStores, pr, lp] = await Promise.all([
        db.from("stores").select("*").eq("household_id", hid).then(must),
        fetchProducts(hid),
        fetchLatestPrices(hid),
      ]);
      const storeMap = new Map((allStores as Store[]).map((s) => [s.id, s]));
      setStores(storeMap);
      setStore(storeMap.get(p.store_id) ?? null);
      setProducts(pr);
      setPrices(lp);
      setPurchase(p);
      await refresh(p);
    })().catch((e: Error) => setError(e.message));
  }, [id, hid, router, refresh]);

  // Duas pessoas comprando juntas veem o mesmo carrinho.
  useEffect(() => {
    if (!purchase) return;
    const db = supabase();
    const channel = db
      .channel(`purchase-${purchase.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "purchase_items", filter: `purchase_id=eq.${purchase.id}` },
        () => void refresh(purchase),
      );
    if (purchase.list_id) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "list_items", filter: `list_id=eq.${purchase.list_id}` },
        () => void refresh(purchase),
      );
    }
    channel.subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [purchase, refresh]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  // Preços de referência: ignoram o que foi lançado nesta compra.
  const reference = useMemo(() => pricesByProduct(prices), [prices]);
  const total = cart.reduce((s, c) => s + Number(c.quantity) * Number(c.unit_price), 0);
  const pending = listItems
    .filter((i) => !i.checked)
    .sort(
      (a, b) =>
        categoryOrder(productById.get(a.product_id)?.category ?? "") -
          categoryOrder(productById.get(b.product_id)?.category ?? "") ||
        (productById.get(a.product_id)?.name ?? "").localeCompare(productById.get(b.product_id)?.name ?? ""),
    );

  function hints(productId: string) {
    const all = reference.get(productId) ?? [];
    const hereLast = all.find((p) => p.store_id === store?.id);
    const bestElsewhere = all.find((p) => p.store_id !== store?.id);
    return {
      hereLast,
      bestElsewhere,
      bestElsewhereStore: bestElsewhere ? stores.get(bestElsewhere.store_id)?.name : undefined,
    };
  }

  async function guard(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      setEditing(null);
      if (purchase) await refresh(purchase);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveItem(product: Product, v: PriceFormValues, listItem?: ListItem, existing?: PurchaseItem) {
    await guard(async () => {
      if (!purchase) return;
      const skuId = v.brand ? await findOrCreateSku(hid, product.id, v.brand, v.packageQty, v.packageUnit) : null;
      const row = {
        quantity: v.quantity,
        unit_price: v.unitPrice,
        package_qty: v.packageQty,
        package_unit: v.packageUnit,
        sku_id: skuId,
      };
      const db = supabase();
      if (existing) {
        must(await db.from("purchase_items").update(row).eq("id", existing.id));
        return;
      }
      must(
        await db.from("purchase_items").insert({
          ...row,
          household_id: hid,
          purchase_id: purchase.id,
          product_id: product.id,
          list_item_id: listItem?.id ?? null,
        }),
      );
      if (listItem) await setListItemChecked(listItem.id, true);
    });
  }

  async function removeItem(item: PurchaseItem) {
    await guard(async () => {
      must(await supabase().from("purchase_items").delete().eq("id", item.id));
      if (item.list_item_id) await setListItemChecked(item.list_item_id, false);
    });
  }

  async function pickExtra(p: PickedProduct) {
    const product = await findOrCreateProduct(hid, p.name, p.category, p.baseUnit, products);
    if (!p.existing) setProducts(await fetchProducts(hid));
    // Se o item estava na lista, usa ele para marcar como comprado.
    const onList = listItems.find((i) => i.product_id === product.id && !i.checked);
    setEditing(onList ? { kind: "list", item: onList, product } : { kind: "extra-price", product });
  }

  async function finish() {
    if (pending.length && !confirm(`Ainda faltam ${pending.length} itens da lista. Finalizar mesmo assim?`)) return;
    await guard(async () => {
      must(
        await supabase()
          .from("purchases")
          .update({ status: "done", finished_at: new Date().toISOString() })
          .eq("id", id),
      );
      router.replace(`/historico/${id}`);
    });
  }

  async function cancel() {
    if (!confirm("Cancelar esta compra? Os preços lançados nela serão apagados.")) return;
    await guard(async () => {
      const linked = cart.map((c) => c.list_item_id).filter(Boolean) as string[];
      if (linked.length) {
        must(await supabase().from("list_items").update({ checked: false, checked_at: null }).in("id", linked));
      }
      must(await supabase().from("purchases").delete().eq("id", id));
      router.replace("/compra");
    });
  }

  if (!purchase) return error ? <ErrorBox message={error} /> : <Loading />;

  return (
    <>
      <header className="sticky top-0 z-30 -mx-4 -mt-6 mb-4 border-b border-border bg-background/95 px-4 pt-6 pb-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted">Comprando em</p>
            <h1 className="truncate text-xl font-bold">{store?.name}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">{cart.length} no carrinho</p>
            <p className="text-2xl font-bold text-accent">{brl(total)}</p>
          </div>
        </div>
      </header>

      <ErrorBox message={error} />

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Faltam ({pending.length})</h2>
          <button className="text-sm text-accent" onClick={() => setEditing({ kind: "extra" })}>
            + Item fora da lista
          </button>
        </div>
        {pending.length === 0 ? (
          <Empty>{listItems.length ? "Tudo da lista está no carrinho! 🎉" : "A lista do mês está vazia."}</Empty>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
            {pending.map((it) => {
              const product = productById.get(it.product_id);
              if (!product) return null;
              const h = hints(it.product_id);
              return (
                <li key={it.id}>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-background"
                    onClick={() => setEditing({ kind: "list", item: it, product })}
                  >
                    <span className="h-6 w-6 shrink-0 rounded-full border-2 border-border" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{product.name}</span>
                      <span className="block truncate text-xs text-muted">
                        Qtd. {formatQty(Number(it.quantity))}
                        {h.hereLast && ` · aqui: ${brl(h.hereLast.price)}`}
                        {h.bestElsewhere && ` · ${h.bestElsewhereStore}: ${brl(h.bestElsewhere.price)}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {cart.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold">No carrinho</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
            {cart.map((c) => {
              const product = productById.get(c.product_id);
              if (!product) return null;
              const sku = c.sku_id ? skus.get(c.sku_id) : undefined;
              return (
                <li key={c.id}>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    onClick={() => setEditing({ kind: "cart", item: c, product })}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-sm text-white">
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{product.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {formatQty(Number(c.quantity))} × {brl(Number(c.unit_price))}
                        {sku?.brand && ` · ${sku.brand}`}
                        {c.package_qty && ` · ${packageLabel(c.package_qty, c.package_unit)}`}
                        {!c.list_item_id && " · fora da lista"}
                      </span>
                    </span>
                    <span className="font-semibold">{brl(Number(c.quantity) * Number(c.unit_price))}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <Button onClick={finish} disabled={cart.length === 0}>
          Finalizar compra · {brl(total)}
        </Button>
        <Button variant="ghost" onClick={cancel} className="text-danger">
          Cancelar compra
        </Button>
        <Link href="/lista" className="text-center text-sm text-muted">
          Editar lista do mês
        </Link>
      </div>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing?.kind === "extra"
            ? "Item fora da lista"
            : editing && "product" in editing
              ? editing.product.name
              : ""
        }
      >
        {editing?.kind === "extra" && (
          <ProductPicker products={products} onPick={pickExtra} submitLabel="Continuar" autoFocus />
        )}
        {editing?.kind === "list" && (
          <PriceForm
            key={editing.item.id}
            product={editing.product}
            initial={{ quantity: Number(editing.item.quantity), ...lastPackage(hints(editing.product.id).hereLast) }}
            {...hints(editing.product.id)}
            submitLabel="Colocar no carrinho"
            onSubmit={(v) => saveItem(editing.product, v, editing.item)}
          />
        )}
        {editing?.kind === "extra-price" && (
          <PriceForm
            key={editing.product.id}
            product={editing.product}
            initial={lastPackage(hints(editing.product.id).hereLast)}
            {...hints(editing.product.id)}
            submitLabel="Colocar no carrinho"
            onSubmit={(v) => saveItem(editing.product, v)}
          />
        )}
        {editing?.kind === "cart" && (
          <PriceForm
            key={editing.item.id}
            product={editing.product}
            initial={{
              unitPrice: Number(editing.item.unit_price),
              quantity: Number(editing.item.quantity),
              packageQty: editing.item.package_qty,
              packageUnit: editing.item.package_unit,
              brand: editing.item.sku_id ? (skus.get(editing.item.sku_id)?.brand ?? "") : "",
            }}
            {...hints(editing.product.id)}
            submitLabel="Salvar"
            onSubmit={(v) => saveItem(editing.product, v, undefined, editing.item)}
            onRemove={() => removeItem(editing.item)}
          />
        )}
      </Sheet>
    </>
  );
}

/** Sugere a mesma embalagem da última compra neste mercado. */
function lastPackage(p?: LatestPrice): Partial<PriceFormValues> {
  return p?.package_qty ? { packageQty: Number(p.package_qty), packageUnit: p.package_unit } : {};
}
