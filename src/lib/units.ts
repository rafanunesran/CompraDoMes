export type BaseUnit = "un" | "kg" | "l";
export type PackageUnit = "un" | "g" | "kg" | "ml" | "l";

export const BASE_UNITS: { value: BaseUnit; label: string }[] = [
  { value: "un", label: "unidade" },
  { value: "kg", label: "kg" },
  { value: "l", label: "litro" },
];

export const PACKAGE_UNITS: PackageUnit[] = ["un", "g", "kg", "ml", "l"];

/** Unidades de embalagem compatíveis com a unidade base do produto. */
export function packageUnitsFor(base: BaseUnit): PackageUnit[] {
  if (base === "kg") return ["g", "kg"];
  if (base === "l") return ["ml", "l"];
  return ["un"];
}

/**
 * Preço por kg / litro / unidade. Mantenha em sincronia com
 * public.normalize_unit_price no SQL.
 * Sem embalagem informada, o preço é considerado por unidade comprada.
 */
export function normalizeUnitPrice(
  price: number,
  packageQty: number | null | undefined,
  packageUnit: PackageUnit | null | undefined,
  base: BaseUnit,
): number | null {
  if (!packageQty || packageQty <= 0 || !packageUnit) return price;
  if (base === "kg" && packageUnit === "g") return price / (packageQty / 1000);
  if (base === "kg" && packageUnit === "kg") return price / packageQty;
  if (base === "l" && packageUnit === "ml") return price / (packageQty / 1000);
  if (base === "l" && packageUnit === "l") return price / packageQty;
  if (base === "un" && packageUnit === "un") return price / packageQty;
  return null;
}

export function perUnitLabel(base: BaseUnit): string {
  return base === "un" ? "/un" : base === "kg" ? "/kg" : "/L";
}

export function packageLabel(qty: number | null | undefined, unit: PackageUnit | null | undefined): string {
  if (!qty || !unit) return "";
  const n = Number.isInteger(qty) ? String(qty) : String(qty).replace(".", ",");
  return unit === "un" ? `${n} un` : `${n}${unit === "l" ? "L" : unit}`;
}
