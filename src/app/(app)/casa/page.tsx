"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/household";
import { Button, Card, ErrorBox, Field, Input, PageHeader } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import type { Member } from "@/lib/types";

function CreateOrJoin({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const { reload, selectHousehold, user } = useHousehold();
  const defaultName = user.email?.split("@")[0] ?? "";
  const [displayName, setDisplayName] = useState(defaultName);
  const [houseName, setHouseName] = useState("Minha casa");
  const [code, setCode] = useState(inviteCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: "create_household" | "join_household", e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const args =
      fn === "create_household"
        ? { p_name: houseName.trim(), p_display_name: displayName.trim() }
        : { p_code: code.trim(), p_display_name: displayName.trim() };
    const { data, error } = await supabase().rpc(fn, args);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    selectHousehold(data as string);
    await reload();
    router.replace("/");
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Seu nome (aparece para a família)">
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </Field>
      <Card>
        <h2 className="mb-1 font-semibold">Entrar com convite</h2>
        <p className="mb-3 text-sm text-muted">Alguém da família já criou a casa? Use o código de convite.</p>
        <form onSubmit={(e) => run("join_household", e)} className="flex gap-2">
          <Input
            placeholder="Código (ex.: A1B2C3)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            required
            className="uppercase tracking-widest"
          />
          <Button type="submit" disabled={busy}>
            Entrar
          </Button>
        </form>
      </Card>
      <Card>
        <h2 className="mb-1 font-semibold">Criar uma casa nova</h2>
        <p className="mb-3 text-sm text-muted">A lista, os mercados e os preços ficam compartilhados com quem entrar nela.</p>
        <form onSubmit={(e) => run("create_household", e)} className="flex gap-2">
          <Input value={houseName} onChange={(e) => setHouseName(e.target.value)} required />
          <Button type="submit" disabled={busy}>
            Criar
          </Button>
        </form>
      </Card>
      <ErrorBox message={error} />
    </div>
  );
}

function HouseholdDetails() {
  const { household, memberships, selectHousehold, user } = useHousehold();
  const [members, setMembers] = useState<Member[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!household) return;
    void supabase()
      .from("household_members")
      .select("*")
      .eq("household_id", household.id)
      .order("joined_at")
      .then(({ data }) => setMembers((data ?? []) as Member[]));
  }, [household]);

  if (!household) return null;
  const link = typeof window !== "undefined" ? `${location.origin}/casa?convite=${household.invite_code}` : "";

  async function share() {
    const text = `Entre na nossa lista de compras no CompraDoMes: ${link}`;
    if (navigator.share) {
      await navigator.share({ title: "CompraDoMes", text, url: link }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-sm text-muted">Código de convite</p>
        <p className="my-1 text-3xl font-bold tracking-[0.3em]">{household.invite_code}</p>
        <Button variant="secondary" className="mt-2 w-full" onClick={share}>
          {copied ? "Link copiado!" : "Convidar pessoa da família"}
        </Button>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Membros</h2>
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li key={m.user_id} className="flex justify-between py-2 text-sm">
              <span>
                {m.display_name || "Sem nome"}
                {m.user_id === user.id && <span className="text-muted"> (você)</span>}
              </span>
              <span className="text-muted">{m.role === "admin" ? "admin" : "membro"}</span>
            </li>
          ))}
        </ul>
      </Card>
      {memberships.length > 1 && (
        <Card>
          <h2 className="mb-2 font-semibold">Trocar de casa</h2>
          <div className="flex flex-col gap-2">
            {memberships.map((m) => (
              <Button
                key={m.household_id}
                variant={m.household_id === household.id ? "primary" : "secondary"}
                onClick={() => selectHousehold(m.household_id)}
              >
                {m.households.name}
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function CasaContent() {
  const { household } = useHousehold();
  const params = useSearchParams();
  const invite = params.get("convite") ?? "";
  const [joiningAnother, setJoiningAnother] = useState(Boolean(invite));

  if (!household) {
    return (
      <>
        <PageHeader title="Bem-vindo(a)!" subtitle="Para começar, crie a sua casa ou entre na da sua família." />
        <CreateOrJoin inviteCode={invite} />
      </>
    );
  }
  return (
    <>
      <PageHeader title={household.name} subtitle="Casa compartilhada" />
      <HouseholdDetails />
      <div className="mt-4">
        {joiningAnother ? (
          <CreateOrJoin inviteCode={invite} />
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => setJoiningAnother(true)}>
            Entrar em outra casa ou criar nova
          </Button>
        )}
      </div>
    </>
  );
}

export default function CasaPage() {
  return (
    <Suspense>
      <CasaContent />
    </Suspense>
  );
}
