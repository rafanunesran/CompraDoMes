"use client";

import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Household, Member } from "@/lib/types";
import { Loading } from "./ui";

interface Membership extends Member {
  households: Household;
}

interface HouseholdState {
  user: User;
  household: Household | null;
  memberships: Membership[];
  selectHousehold: (id: string) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<HouseholdState | null>(null);
const STORAGE_KEY = "compradomes:household";

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const db = supabase();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) {
      router.replace("/login");
      return;
    }
    setUser(auth.user);
    const { data } = await db
      .from("household_members")
      .select("household_id, user_id, role, display_name, households(id, name, invite_code)")
      .eq("user_id", auth.user.id);
    const list = (data ?? []) as unknown as Membership[];
    setMemberships(list);
    setSelectedId((cur) => {
      const wanted = cur ?? readStored();
      return list.find((m) => m.household_id === wanted)?.household_id ?? list[0]?.household_id ?? null;
    });
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial vinda do Supabase
    void reload();
  }, [reload]);

  const household = memberships?.find((m) => m.household_id === selectedId)?.households ?? null;

  useEffect(() => {
    if (memberships && !household && pathname !== "/casa") router.replace("/casa");
  }, [memberships, household, pathname, router]);

  const selectHousehold = useCallback((id: string) => {
    setSelectedId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // armazenamento indisponível: segue só em memória
    }
  }, []);

  if (!user || !memberships) return <Loading />;
  if (!household && pathname !== "/casa") return <Loading />;

  return (
    <Ctx.Provider value={{ user, household, memberships, selectHousehold, reload }}>{children}</Ctx.Provider>
  );
}

export function useHousehold(): HouseholdState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHousehold fora do HouseholdProvider");
  return ctx;
}

/** Para telas que só aparecem depois que a casa existe. */
export function useHouseholdId(): string {
  const { household } = useHousehold();
  if (!household) throw new Error("Nenhuma casa selecionada");
  return household.id;
}
