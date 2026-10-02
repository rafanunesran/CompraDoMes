"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useHousehold } from "@/components/household";
import { Button, PageHeader } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

const links = [
  { href: "/historico", title: "Histórico de compras", desc: "Todas as compras, por mês" },
  { href: "/mercados", title: "Mercados", desc: "Cadastrar e editar mercados" },
  { href: "/produtos", title: "Produtos e preços", desc: "Catálogo e comparação" },
  { href: "/casa", title: "Casa e família", desc: "Convidar pessoas, trocar de casa" },
];

export default function MorePage() {
  const { user, household } = useHousehold();
  const router = useRouter();

  async function logout() {
    await supabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <PageHeader title="Mais" subtitle={`${household?.name} · ${user.email}`} />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center justify-between px-4 py-4">
              <span>
                <span className="block font-medium">{l.title}</span>
                <span className="block text-xs text-muted">{l.desc}</span>
              </span>
              <span className="text-muted">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-muted">
        Em breve: escanear cupom fiscal (NFC-e), juntar produtos de marcas diferentes e recomendação de onde comprar.
      </p>
      <Button variant="ghost" className="mt-4 w-full text-danger" onClick={logout}>
        Sair
      </Button>
    </>
  );
}
