import type { BaseUnit, PackageUnit } from "./units";

export interface Household {
  id: string;
  name: string;
  invite_code: string;
}

export interface Member {
  household_id: string;
  user_id: string;
  role: "admin" | "member";
  display_name: string | null;
}

export interface Store {
  id: string;
  household_id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  household_id: string;
  name: string;
  category: string;
  base_unit: BaseUnit;
}

export interface Sku {
  id: string;
  product_id: string;
  brand: string | null;
  ean: string | null;
  package_qty: number | null;
  package_unit: PackageUnit | null;
}

export interface ShoppingList {
  id: string;
  household_id: string;
  month: string;
}

export interface ListItem {
  id: string;
  household_id: string;
  list_id: string;
  product_id: string;
  quantity: number;
  note: string | null;
  checked: boolean;
  checked_at: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  household_id: string;
  store_id: string;
  list_id: string | null;
  status: "open" | "done";
  started_at: string;
  finished_at: string | null;
}

export interface PurchaseSummary extends Purchase {
  total: number;
  item_count: number;
}

export interface PurchaseItem {
  id: string;
  household_id: string;
  purchase_id: string;
  product_id: string;
  sku_id: string | null;
  list_item_id: string | null;
  quantity: number;
  unit_price: number;
  package_qty: number | null;
  package_unit: PackageUnit | null;
  created_at: string;
}

export interface PriceObservation {
  id: string;
  product_id: string;
  sku_id: string | null;
  store_id: string;
  price: number;
  package_qty: number | null;
  package_unit: PackageUnit | null;
  unit_price_normalized: number | null;
  observed_at: string;
  source: "manual" | "purchase" | "nfce" | "ocr";
}

export type LatestPrice = Omit<PriceObservation, "id">;
