"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useHouseholdId } from "@/components/household";
import { Button, Card, ErrorBox, Field, Input, Loading, PageHeader } from "@/components/ui";
import { fetchOpenPurchase, fetchStores, getOrCreateList, must } from "@/lib/db";
import { relativeDays } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { Store } from "@/lib/types";

export default function StartPurchasePage() {
  const hid = useHouseholdId();
  const router = useRouter();
  const [stores, setStores] = useState<(Store & { lastVisit?: string })[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const open = await fetchOpenPurchase(hid);
      if (open) {
        router.replace(`/compra/${open.id}`);
        return;
      }
      const [st, visits] = await Promise.all([
        fetchStores(hid),
        supabase()
          .from("purchases")
          .select("store_id, started_at")
          .eq("household_id", hid)
          .order("started_at", { ascending: false })
          .limit(200)
          .then(must),
      ]);
      const last = new Map<string, string>();
      for (const v of visits as { store_id: string; started_at: string }[]) {
        if (!last.has(v.store_id)) last.set(v.store_id, v.started_at);
      }
      const withVisit = st.map((s) => ({ ...s, lastVisit: last.get(s.id) }));
      withVisit.sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? "") || a.name.localeCompare(b.name));
      setStores(withVisit);
      setShowNew(withVisit.length === 0);
    })().catch((e: Error) => setError(e.message));
  }, [hid, router]);

  async function start(storeId: string) {
    setBusy(true);
    setError(null);
    try {
      const list = await getOrCreateList(hid);
      const purchase = must(
        await supabase()
          .from("purchases")
          .insert({ household_id: hid, store_id: storeId, list_id: list.id })
          .select("id")
          .single(),
      ) as { id: string };
      router.push(`/compra/${purchase.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function createAndStart(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const store = must(
        await supabase()
          .from("stores")
          .insert({ household_id: hid, name: newName.trim(), address: newAddress.trim() || null })
          .select("id")
          .single(),
      ) as { id: string };
      await start(store.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!stores) return error ? <ErrorBox message={error} /> : <Loading />;

  return (
    <>
      <PageHeader title="Iniciar compra" subtitle="Em qual mercado você está?" />
      <ErrorBox message={error} />
      <div className="flex flex-col gap-2">
        {stores.map((s) => (
          <button
            key={s.id}
            disabled={busy}
            onClick={() => start(s.id)}
            className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4 text-left disabled:opacity-50"
          >
            <span>
              <span className="block font-medium">{s.name}</span>
              {s.address && <span className="block text-xs text-muted">{s.address}</span>}
            </span>
            <span className="text-xs text-muted">{s.lastVisit ? relativeDays(s.lastVisit) : "nunca"}</span>
          </button>
        ))}
      </div>

      <Card className="mt-4">
        {showNew ? (
          <form onSubmit={createAndStart} className="flex flex-col gap-3">
            <h2 className="font-semibold">Novo mercado</h2>
            <Field label="Nome">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: Atacadão Centro"
                required
              />
            </Field>
            <Field label="Endereço ou bairro (opcional)">
              <Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy || !newName.trim()}>
              Cadastrar e começar
            </Button>
          </form>
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => setShowNew(true)}>
            + Outro mercado
          </Button>
        )}
      </Card>
    </>
  );
}
