import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";
import { monthKey } from "./format";
import type { BaseUnit } from "./units";
import type {
  LatestPrice,
  ListItem,
  Product,
  Purchase,
  ShoppingList,
  Store,
} from "./types";

export function must<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function getOrCreateList(householdId: string, month = monthKey()): Promise<ShoppingList> {
  const db = supabase();
  const existing = must(
    await db.from("shopping_lists").select("*").eq("household_id", householdId).eq("month", month).maybeSingle(),
  ) as ShoppingList | null;
  if (existing) return existing;
  must(
    await db
      .from("shopping_lists")
      .upsert({ household_id: householdId, month }, { onConflict: "household_id,month", ignoreDuplicates: true }),
  );
  return must(
    await db.from("shopping_lists").select("*").eq("household_id", householdId).eq("month", month).single(),
  ) as ShoppingList;
}

export async function fetchProducts(householdId: string): Promise<Product[]> {
  return must(
    await supabase().from("products").select("*").eq("household_id", householdId).order("name"),
  ) as Product[];
}

export async function fetchStores(householdId: string): Promise<Store[]> {
  return must(
    await supabase().from("stores").select("*").eq("household_id", householdId).order("name"),
  ) as Store[];
}

export async function fetchLatestPrices(householdId: string): Promise<LatestPrice[]> {
  return must(await supabase().from("latest_prices").select("*").eq("household_id", householdId)) as LatestPrice[];
}

export async function fetchListItems(listId: string): Promise<ListItem[]> {
  return must(
    await supabase().from("list_items").select("*").eq("list_id", listId).order("created_at"),
  ) as ListItem[];
}

export async function fetchOpenPurchase(householdId: string): Promise<Purchase | null> {
  return must(
    await supabase()
      .from("purchases")
      .select("*")
      .eq("household_id", householdId)
      .eq("status", "open")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as Purchase | null;
}

/** Escapa curingas do ILIKE para buscar o texto exato (sem diferenciar maiúsculas). */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function findProduct(products: Product[], name: string): Product | undefined {
  const key = normalizeName(name).toLowerCase();
  return products.find((p) => p.name.toLowerCase() === key);
}

/** Busca o produto pelo nome (sem diferenciar maiúsculas) ou cria um novo. */
export async function findOrCreateProduct(
  householdId: string,
  name: string,
  category: string,
  baseUnit: BaseUnit,
  known: Product[] = [],
): Promise<Product> {
  const clean = normalizeName(name);
  const found = findProduct(known, clean);
  if (found) return found;
  const db = supabase();
  const res = await db
    .from("products")
    .insert({ household_id: householdId, name: clean, category, base_unit: baseUnit })
    .select()
    .single();
  if (res.error?.code === "23505") {
    return must(
      await db.from("products").select("*").eq("household_id", householdId).ilike("name", escapeLike(clean)).single(),
    ) as Product;
  }
  return must(res) as Product;
}

/** Adiciona à lista; se o produto já estiver nela, soma a quantidade. */
export async function addToList(
  householdId: string,
  listId: string,
  productId: string,
  quantity = 1,
): Promise<void> {
  const db = supabase();
  const existing = must(
    await db.from("list_items").select("*").eq("list_id", listId).eq("product_id", productId).maybeSingle(),
  ) as ListItem | null;
  if (existing) {
    must(
      await db
        .from("list_items")
        .update({ quantity: Number(existing.quantity) + quantity, checked: false, checked_at: null })
        .eq("id", existing.id),
    );
    return;
  }
  must(
    await db.from("list_items").insert({ household_id: householdId, list_id: listId, product_id: productId, quantity }),
  );
}

export async function setListItemChecked(id: string, checked: boolean): Promise<void> {
  must(
    await supabase()
      .from("list_items")
      .update({ checked, checked_at: checked ? new Date().toISOString() : null })
      .eq("id", id),
  );
}

export async function findOrCreateSku(
  householdId: string,
  productId: string,
  brand: string,
  packageQty: number | null,
  packageUnit: string | null,
): Promise<string> {
  const db = supabase();
  let q = db.from("skus").select("id").eq("product_id", productId).ilike("brand", escapeLike(brand.trim()));
  q = packageQty ? q.eq("package_qty", packageQty) : q.is("package_qty", null);
  q = packageUnit ? q.eq("package_unit", packageUnit) : q.is("package_unit", null);
  const found = must(await q.limit(1).maybeSingle()) as { id: string } | null;
  if (found) return found.id;
  const created = must(
    await db
      .from("skus")
      .insert({
        household_id: householdId,
        product_id: productId,
        brand: brand.trim(),
        package_qty: packageQty,
        package_unit: packageUnit,
      })
      .select("id")
      .single(),
  ) as { id: string };
  return created.id;
}
