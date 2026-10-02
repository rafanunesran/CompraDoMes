"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Button, Card, ErrorBox, Field, Input } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("erro") ? "Não foi possível confirmar o e-mail. Tente entrar novamente." : null,
  );
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const db = supabase();
    if (mode === "entrar") {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
        setBusy(false);
        return;
      }
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
      return;
    }
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } else {
      setInfo("Conta criada! Confirme pelo link enviado para o seu e-mail e depois entre.");
      setMode("entrar");
    }
  }

  return (
    <Card>
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-background p-1 text-sm font-medium">
        {(["entrar", "criar"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 ${mode === m ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {m === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="E-mail">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Senha" hint={mode === "criar" ? "Mínimo de 6 caracteres" : undefined}>
          <Input
            type="password"
            autoComplete={mode === "entrar" ? "current-password" : "new-password"}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorBox message={error} />
        {info && <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">{info}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Aguarde…" : mode === "entrar" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="mx-auto mb-3 h-16 w-16" />
        <h1 className="text-3xl font-bold tracking-tight">CompraDoMes</h1>
        <p className="text-muted">Lista do mês, preços e onde comprar mais barato.</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
