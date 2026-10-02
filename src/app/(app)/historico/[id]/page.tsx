"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ErrorBox, Loading, PageHeader } from "@/components/ui";
import { must } from "@/lib/db";
import { brl, dateLabel, formatQty } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { Purchase, PurchaseItem } from "@/lib/types";
import { packageLabel } from "@/lib/units";

type Row = PurchaseItem & { products: { name: string } | null; skus: { brand: string | null } | null };

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [purchase, setPurchase] = useState<(Purchase & { stores: { name: string } | null }) | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = supabase();
    Promise.all([
      db.from("purchases").select("*, stores(name)").eq("id", id).single().then(must),
      db
        .from("purchase_items")
        .select("*, products(name), skus(brand)")
        .eq("purchase_id", id)
        .order("created_at")
        .then(must),
    ])
      .then(([p, i]) => {
        setPurchase(p as Purchase & { stores: { name: string } | null });
        setItems(i as Row[]);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  async function reopen() {
    must(await supabase().from("purchases").update({ status: "open", finished_at: null }).eq("id", id));
    router.push(`/compra/${id}`);
  }

  async function remove() {
    if (!confirm("Apagar esta compra e os preços registrados nela?")) return;
    must(await supabase().from("purchases").delete().eq("id", id));
    router.replace("/historico");
  }

  if (error) return <ErrorBox message={error} />;
  if (!purchase) return <Loading />;

  const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);

  return (
    <>
      <PageHeader
        title={purchase.stores?.name ?? "Compra"}
        subtitle={`${dateLabel(purchase.started_at)} · ${items.length} itens`}
        action={<p className="text-2xl font-bold text-accent">{brl(total)}</p>}
      />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
        {items.map((i) => (
          <li key={i.id}>
            <Link href={`/produtos/${i.product_id}`} className="flex justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate">{i.products?.name}</span>
                <span className="block truncate text-xs text-muted">
                  {formatQty(Number(i.quantity))} × {brl(Number(i.unit_price))}
                  {i.skus?.brand && ` · ${i.skus.brand}`}
                  {i.package_qty && ` · ${packageLabel(Number(i.package_qty), i.package_unit)}`}
                </span>
              </span>
              <span className="font-medium">{brl(Number(i.quantity) * Number(i.unit_price))}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-2">
        <Button variant="secondary" onClick={reopen}>
          Reabrir para editar
        </Button>
        <Button variant="ghost" className="text-danger" onClick={remove}>
          Apagar compra
        </Button>
      </div>
    </>
  );
}
