"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useHouseholdId } from "@/components/household";
import { PriceForm } from "@/components/price-form";
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Select, Sheet } from "@/components/ui";
import { CATEGORIES } from "@/lib/categories";
import { comparableValue } from "@/lib/compare";
import { fetchStores, findOrCreateSku, must } from "@/lib/db";
import { brl, dateLabel, relativeDays } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { PriceObservation, Product, Store } from "@/lib/types";
import { BASE_UNITS, packageLabel, perUnitLabel, type BaseUnit } from "@/lib/units";

type Obs = PriceObservation & { skus: { brand: string | null } | null };

const SOURCE_LABEL: Record<PriceObservation["source"], string> = {
  manual: "anotado",
  purchase: "compra",
  nfce: "cupom",
  ocr: "foto",
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const hid = useHouseholdId();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<Obs[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [storeId, setStoreId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = supabase();
    const [p, h, s] = await Promise.all([
      db.from("products").select("*").eq("id", id).single().then(must),
      db
        .from("price_observations")
        .select("*, skus(brand)")
        .eq("product_id", id)
        .order("observed_at", { ascending: false })
        .limit(100)
        .then(must),
      fetchStores(hid),
    ]);
    setProduct(p as Product);
    setHistory(h as Obs[]);
    setStores(s);
    setStoreId((cur) => cur || s[0]?.id || "");
  }, [id, hid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga assíncrona vinda do Supabase
    load().catch((e: Error) => setError(e.message));
  }, [load]);

  if (error && !product) return <ErrorBox message={error} />;
  if (!product) return <Loading />;

  const storeName = new Map(stores.map((s) => [s.id, s.name]));
  const latestByStore = new Map<string, Obs>();
  for (const o of history) if (!latestByStore.has(o.store_id)) latestByStore.set(o.store_id, o);
  const ranking = [...latestByStore.values()].sort((a, b) => comparableValue(a) - comparableValue(b));
  const per = perUnitLabel(product.base_unit);
  const cheapest = ranking[0];

  async function saveProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    try {
      must(
        await supabase()
          .from("products")
          .update({
            name: String(form.get("name")).trim(),
            category: String(form.get("category")),
            base_unit: String(form.get("base_unit")) as BaseUnit,
          })
          .eq("id", id),
      );
      setEditing(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removeProduct() {
    if (!confirm(`Apagar "${product!.name}"? Ele sai da lista e o histórico de preços dele é apagado.`)) return;
    try {
      must(await supabase().from("products").delete().eq("id", id));
      router.replace("/produtos");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={`${product.category} · comparando por ${BASE_UNITS.find((u) => u.value === product.base_unit)?.label}`}
        action={
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Editar
          </Button>
        }
      />
      <ErrorBox message={error} />

      <Card className="mb-4">
        <h2 className="mb-3 font-semibold">Último preço por mercado</h2>
        {ranking.length === 0 ? (
          <p className="text-sm text-muted">Nenhum preço registrado ainda.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {ranking.map((o, i) => {
              const diff = comparableValue(o) - comparableValue(cheapest);
              return (
                <li key={o.store_id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className={`block truncate ${i === 0 ? "font-semibold text-accent" : ""}`}>
                      {i === 0 && "🏆 "}
                      {storeName.get(o.store_id)}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {brl(Number(o.price))}
                      {o.package_qty && ` · ${packageLabel(Number(o.package_qty), o.package_unit)}`}
                      {o.skus?.brand && ` · ${o.skus.brand}`} · {relativeDays(o.observed_at)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold">
                      {brl(comparableValue(o))}
                      <span className="text-xs font-normal">{per}</span>
                    </span>
                    {i > 0 && diff > 0 && <span className="block text-xs text-warn">+{brl(diff)}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <Button variant="secondary" className="mt-4 w-full" onClick={() => setAdding(true)} disabled={!stores.length}>
          Anotar preço visto em um mercado
        </Button>
      </Card>

      <h2 className="mb-2 font-semibold">Histórico</h2>
      {history.length === 0 ? (
        <Empty>Os preços aparecem aqui depois das compras.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface text-sm">
          {history.map((o) => (
            <li key={o.id} className="flex justify-between gap-3 px-4 py-2">
              <span className="min-w-0">
                <span className="block truncate">{storeName.get(o.store_id)}</span>
                <span className="block truncate text-xs text-muted">
                  {dateLabel(o.observed_at)} · {SOURCE_LABEL[o.source]}
                  {o.skus?.brand && ` · ${o.skus.brand}`}
                  {o.package_qty && ` · ${packageLabel(Number(o.package_qty), o.package_unit)}`}
                </span>
              </span>
              <span className="text-right">
                {brl(Number(o.price))}
                {o.unit_price_normalized != null && o.package_qty && (
                  <span className="block text-xs text-muted">
                    {brl(Number(o.unit_price_normalized))}
                    {per}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={editing} onClose={() => setEditing(false)} title="Editar produto">
        <form onSubmit={saveProduct} className="flex flex-col gap-3">
          <Field label="Nome">
            <Input name="name" defaultValue={product.name} required />
          </Field>
          <Field label="Categoria">
            <Select name="category" defaultValue={product.category}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Comparar preço por" hint="Use kg ou litro para comparar embalagens de tamanhos diferentes.">
            <Select name="base_unit" defaultValue={product.base_unit}>
              {BASE_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Salvar</Button>
          <Button type="button" variant="ghost" className="text-danger" onClick={removeProduct}>
            Apagar produto
          </Button>
        </form>
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Anotar preço">
        <div className="mb-3">
          <Field label="Mercado">
            <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <PriceForm
          product={product}
          showQuantity={false}
          hereLast={latestByStore.get(storeId)}
          submitLabel="Salvar preço"
          onSubmit={async (v) => {
            setError(null);
            try {
              const skuId = v.brand ? await findOrCreateSku(hid, product.id, v.brand, v.packageQty, v.packageUnit) : null;
              must(
                await supabase().from("price_observations").insert({
                  household_id: hid,
                  product_id: product.id,
                  store_id: storeId,
                  sku_id: skuId,
                  price: v.unitPrice,
                  package_qty: v.packageQty,
                  package_unit: v.packageUnit,
                  source: "manual",
                }),
              );
              setAdding(false);
              await load();
            } catch (err) {
              setError((err as Error).message);
              setAdding(false);
            }
          }}
        />
      </Sheet>
    </>
  );
}
