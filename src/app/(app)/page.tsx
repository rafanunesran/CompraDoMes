"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useHousehold } from "@/components/household";
import { Card, ErrorBox, LinkButton, Loading, PageHeader } from "@/components/ui";
import { fetchListItems, fetchOpenPurchase, fetchStores, getOrCreateList, must } from "@/lib/db";
import { brl, dateLabel, monthKey, monthLabel, shiftMonth } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { ListItem, Purchase, PurchaseSummary, Store } from "@/lib/types";

interface DashboardData {
  items: ListItem[];
  open: Purchase | null;
  stores: Map<string, Store>;
  thisMonth: PurchaseSummary[];
  lastMonthTotal: number;
}

export default function HomePage() {
  const { household } = useHousehold();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const month = monthKey();

  useEffect(() => {
    if (!household) return;
    const hid = household.id;
    (async () => {
      const list = await getOrCreateList(hid, month);
      const [items, open, stores, summaries] = await Promise.all([
        fetchListItems(list.id),
        fetchOpenPurchase(hid),
        fetchStores(hid),
        supabase()
          .from("purchase_summaries")
          .select("*")
          .eq("household_id", hid)
          .eq("status", "done")
          .gte("started_at", new Date(`${shiftMonth(month, -1)}T00:00:00`).toISOString())
          .order("started_at", { ascending: false })
          .then(must),
      ]);
      const start = new Date(`${month}T00:00:00`).getTime();
      const all = summaries as PurchaseSummary[];
      setData({
        items,
        open,
        stores: new Map(stores.map((s) => [s.id, s])),
        thisMonth: all.filter((p) => new Date(p.started_at).getTime() >= start),
        lastMonthTotal: all
          .filter((p) => new Date(p.started_at).getTime() < start)
          .reduce((s, p) => s + Number(p.total), 0),
      });
    })().catch((e: Error) => setError(e.message));
  }, [household, month]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const done = data.items.filter((i) => i.checked).length;
  const total = data.items.length;
  const spent = data.thisMonth.reduce((s, p) => s + Number(p.total), 0);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <PageHeader title="CompraDoMes" subtitle={`${household?.name} · ${monthLabel(month)}`} />

      {data.open && (
        <Link
          href={`/compra/${data.open.id}`}
          className="mb-4 block rounded-2xl bg-accent p-4 text-white shadow-sm"
        >
          <p className="text-sm opacity-90">Compra em andamento</p>
          <p className="text-lg font-semibold">
            {data.stores.get(data.open.store_id)?.name ?? "Mercado"} — continuar →
          </p>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-sm text-muted">Lista do mês</p>
          <p className="text-2xl font-bold">
            {done}/{total}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </Card>
        <Card>
          <p className="text-sm text-muted">Gasto no mês</p>
          <p className="text-2xl font-bold">{brl(spent)}</p>
          <p className="mt-1 text-xs text-muted">Mês passado: {brl(data.lastMonthTotal)}</p>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <LinkButton href="/lista" variant="secondary">
          Ver lista
        </LinkButton>
        <LinkButton href="/compra">{data.open ? "Comprar" : "Iniciar compra"}</LinkButton>
      </div>

      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Compras deste mês</h2>
          <Link href="/historico" className="text-sm text-accent">
            Histórico
          </Link>
        </div>
        {data.thisMonth.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma compra finalizada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.thisMonth.map((p) => (
              <li key={p.id}>
                <Link href={`/historico/${p.id}`} className="flex justify-between rounded-xl bg-surface px-4 py-3">
                  <span>
                    <span className="font-medium">{data.stores.get(p.store_id)?.name}</span>
                    <span className="block text-xs text-muted">
                      {dateLabel(p.started_at)} · {p.item_count} itens
                    </span>
                  </span>
                  <span className="font-semibold">{brl(Number(p.total))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
