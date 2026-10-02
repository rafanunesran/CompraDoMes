"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useHouseholdId } from "@/components/household";
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Sheet } from "@/components/ui";
import { fetchStores, must } from "@/lib/db";
import { brl, relativeDays } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { PurchaseSummary, Store } from "@/lib/types";

interface StoreStats {
  visits: number;
  spent: number;
  last?: string;
}

export default function StoresPage() {
  const hid = useHouseholdId();
  const [stores, setStores] = useState<Store[] | null>(null);
  const [stats, setStats] = useState<Map<string, StoreStats>>(new Map());
  const [editing, setEditing] = useState<Store | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([
      fetchStores(hid),
      supabase()
        .from("purchase_summaries")
        .select("store_id, total, started_at")
        .eq("household_id", hid)
        .eq("status", "done")
        .then(must),
    ]);
    const map = new Map<string, StoreStats>();
    for (const row of p as Pick<PurchaseSummary, "store_id" | "total" | "started_at">[]) {
      const cur = map.get(row.store_id) ?? { visits: 0, spent: 0 };
      cur.visits++;
      cur.spent += Number(row.total);
      if (!cur.last || row.started_at > cur.last) cur.last = row.started_at;
      map.set(row.store_id, cur);
    }
    setStores(s);
    setStats(map);
  }, [hid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga assíncrona vinda do Supabase
    load().catch((e: Error) => setError(e.message));
  }, [load]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const row = {
      name: String(form.get("name")).trim(),
      address: String(form.get("address")).trim() || null,
      cnpj: String(form.get("cnpj")).replace(/\D/g, "") || null,
    };
    setError(null);
    try {
      const db = supabase();
      if (editing === "new") must(await db.from("stores").insert({ ...row, household_id: hid }));
      else if (editing) must(await db.from("stores").update(row).eq("id", editing.id));
      setEditing(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(store: Store) {
    if (!confirm(`Apagar "${store.name}"? Os preços anotados nele também serão apagados.`)) return;
    const { error } = await supabase().from("stores").delete().eq("id", store.id);
    if (error) {
      setError(
        error.code === "23503" ? "Este mercado tem compras registradas. Apague as compras antes." : error.message,
      );
      return;
    }
    setEditing(null);
    await load();
  }

  if (!stores) return error ? <ErrorBox message={error} /> : <Loading />;

  return (
    <>
      <PageHeader
        title="Mercados"
        subtitle={`${stores.length} cadastrados`}
        action={<Button onClick={() => setEditing("new")}>+ Novo</Button>}
      />
      <ErrorBox message={error} />
      {stores.length === 0 ? (
        <Empty>Cadastre os mercados onde vocês costumam comprar.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {stores.map((s) => {
            const st = stats.get(s.id);
            return (
              <li key={s.id}>
                <button onClick={() => setEditing(s)} className="w-full text-left">
                  <Card>
                    <div className="flex justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{s.name}</span>
                        {s.address && <span className="block truncate text-xs text-muted">{s.address}</span>}
                      </span>
                      <span className="shrink-0 text-right text-xs text-muted">
                        {st ? (
                          <>
                            {st.visits} {st.visits === 1 ? "compra" : "compras"} · {brl(st.spent)}
                            <span className="block">{st.last && relativeDays(st.last)}</span>
                          </>
                        ) : (
                          "sem compras"
                        )}
                      </span>
                    </div>
                  </Card>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Novo mercado" : "Editar mercado"}>
        {editing !== null && (
          <form onSubmit={save} className="flex flex-col gap-3" key={editing === "new" ? "new" : editing.id}>
            <Field label="Nome">
              <Input name="name" defaultValue={editing === "new" ? "" : editing.name} required />
            </Field>
            <Field label="Endereço ou bairro">
              <Input name="address" defaultValue={editing === "new" ? "" : (editing.address ?? "")} />
            </Field>
            <Field label="CNPJ" hint="Preenchido automaticamente quando você escanear um cupom.">
              <Input name="cnpj" inputMode="numeric" defaultValue={editing === "new" ? "" : (editing.cnpj ?? "")} />
            </Field>
            <Button type="submit">Salvar</Button>
            {editing !== "new" && (
              <Button type="button" variant="ghost" className="text-danger" onClick={() => remove(editing)}>
                Apagar mercado
              </Button>
            )}
          </form>
        )}
      </Sheet>
    </>
  );
}
