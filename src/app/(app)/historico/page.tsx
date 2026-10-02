"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useHouseholdId } from "@/components/household";
import { Empty, ErrorBox, Loading, PageHeader } from "@/components/ui";
import { fetchStores, must } from "@/lib/db";
import { brl, dateLabel, monthKey, monthLabel } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { PurchaseSummary, Store } from "@/lib/types";

export default function HistoryPage() {
  const hid = useHouseholdId();
  const [purchases, setPurchases] = useState<PurchaseSummary[] | null>(null);
  const [stores, setStores] = useState<Map<string, Store>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase()
        .from("purchase_summaries")
        .select("*")
        .eq("household_id", hid)
        .order("started_at", { ascending: false })
        .limit(200)
        .then(must),
      fetchStores(hid),
    ])
      .then(([p, s]) => {
        setPurchases(p as PurchaseSummary[]);
        setStores(new Map(s.map((x) => [x.id, x])));
      })
      .catch((e: Error) => setError(e.message));
  }, [hid]);

  if (error) return <ErrorBox message={error} />;
  if (!purchases) return <Loading />;

  const byMonth = new Map<string, PurchaseSummary[]>();
  for (const p of purchases) {
    const k = monthKey(new Date(p.started_at));
    byMonth.set(k, [...(byMonth.get(k) ?? []), p]);
  }

  return (
    <>
      <PageHeader title="Histórico" subtitle="Todas as compras da casa" />
      {purchases.length === 0 && <Empty>Nenhuma compra registrada ainda.</Empty>}
      <div className="flex flex-col gap-5">
        {[...byMonth.entries()].map(([month, list]) => (
          <section key={month}>
            <div className="mb-1 flex justify-between text-sm">
              <h2 className="font-semibold">{monthLabel(month)}</h2>
              <span className="text-muted">{brl(list.reduce((s, p) => s + Number(p.total), 0))}</span>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
              {list.map((p) => (
                <li key={p.id}>
                  <Link
                    href={p.status === "open" ? `/compra/${p.id}` : `/historico/${p.id}`}
                    className="flex justify-between px-4 py-3"
                  >
                    <span>
                      <span className="font-medium">{stores.get(p.store_id)?.name}</span>
                      <span className="block text-xs text-muted">
                        {dateLabel(p.started_at)} · {p.item_count} itens
                        {p.status === "open" && " · em andamento"}
                      </span>
                    </span>
                    <span className="font-semibold">{brl(Number(p.total))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
