"use client";

import { useState, type FormEvent } from "react";
import { comparableValue } from "@/lib/compare";
import { brl, parseDecimal } from "@/lib/format";
import type { LatestPrice, Product } from "@/lib/types";
import { normalizeUnitPrice, packageUnitsFor, perUnitLabel, type PackageUnit } from "@/lib/units";
import { Button, Field, Input, Select } from "./ui";

export interface PriceFormValues {
  unitPrice: number;
  quantity: number;
  packageQty: number | null;
  packageUnit: PackageUnit | null;
  brand: string;
}

/**
 * Formulário de preço usado no modo compra. Mostra, enquanto digita,
 * se o preço está acima do melhor preço conhecido em outro mercado.
 */
export function PriceForm({
  product,
  initial,
  showQuantity = true,
  hereLast,
  bestElsewhere,
  bestElsewhereStore,
  submitLabel,
  onSubmit,
  onRemove,
}: {
  product: Product;
  initial?: Partial<PriceFormValues>;
  showQuantity?: boolean;
  hereLast?: LatestPrice;
  bestElsewhere?: LatestPrice;
  bestElsewhereStore?: string;
  submitLabel: string;
  onSubmit: (v: PriceFormValues) => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const units = packageUnitsFor(product.base_unit);
  const [price, setPrice] = useState(initial?.unitPrice != null ? String(initial.unitPrice).replace(".", ",") : "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [pkgQty, setPkgQty] = useState(initial?.packageQty ? String(initial.packageQty).replace(".", ",") : "");
  const [pkgUnit, setPkgUnit] = useState<PackageUnit>(initial?.packageUnit ?? units[0]);
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [busy, setBusy] = useState(false);

  const unitPrice = parseDecimal(price);
  const packageQty = parseDecimal(pkgQty);
  const qty = parseDecimal(quantity) ?? 1;
  const normalized =
    unitPrice != null ? normalizeUnitPrice(unitPrice, packageQty, packageQty ? pkgUnit : null, product.base_unit) : null;
  const per = perUnitLabel(product.base_unit);
  const diff = normalized != null && bestElsewhere ? normalized - comparableValue(bestElsewhere) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (unitPrice == null) return;
    setBusy(true);
    try {
      await onSubmit({
        unitPrice,
        quantity: qty,
        packageQty: packageQty || null,
        packageUnit: packageQty ? pkgUnit : null,
        brand: brand.trim(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Field label="Preço (R$)">
          <Input
            inputMode="decimal"
            placeholder="0,00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            autoFocus
            required
            className="text-xl font-semibold"
          />
        </Field>
        {showQuantity && (
          <Field label="Qtd.">
            <Input
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-20 text-center text-xl"
            />
          </Field>
        )}
      </div>

      <Field label="Embalagem (opcional, para comparar por kg/L)">
        <div className="flex gap-2">
          <Input
            inputMode="decimal"
            placeholder={product.base_unit === "kg" ? "Ex.: 500" : product.base_unit === "l" ? "Ex.: 900" : "Ex.: 12"}
            value={pkgQty}
            onChange={(e) => setPkgQty(e.target.value)}
          />
          <Select value={pkgUnit} onChange={(e) => setPkgUnit(e.target.value as PackageUnit)} className="w-24">
            {units.map((u) => (
              <option key={u} value={u}>
                {u === "l" ? "L" : u}
              </option>
            ))}
          </Select>
        </div>
      </Field>

      <Field label="Marca (opcional)">
        <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex.: Camil" />
      </Field>

      <div className="rounded-xl bg-background p-3 text-sm">
        {normalized != null && packageQty ? (
          <p>
            = <strong>{brl(normalized)}</strong>
            {per}
          </p>
        ) : null}
        {hereLast && (
          <p className="text-muted">
            Última vez aqui: {brl(hereLast.price)}
            {hereLast.unit_price_normalized != null && hereLast.package_qty
              ? ` (${brl(hereLast.unit_price_normalized)}${per})`
              : ""}
          </p>
        )}
        {bestElsewhere && (
          <p className="text-muted">
            Melhor em outro mercado: {brl(comparableValue(bestElsewhere))}
            {per} no {bestElsewhereStore}
          </p>
        )}
        {diff != null && diff > 0.005 && (
          <p className="mt-1 font-medium text-warn">
            ⚠ {brl(diff)}
            {per} mais caro que no {bestElsewhereStore}
          </p>
        )}
        {diff != null && diff < -0.005 && <p className="mt-1 font-medium text-accent">✓ Melhor preço conhecido</p>}
        {!hereLast && !bestElsewhere && normalized == null && <p className="text-muted">Primeiro preço deste produto.</p>}
      </div>

      <Button type="submit" disabled={busy || unitPrice == null}>
        {submitLabel}
        {unitPrice != null && showQuantity ? ` · ${brl(unitPrice * qty)}` : ""}
      </Button>
      {onRemove && (
        <Button
          type="button"
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onRemove();
            } finally {
              setBusy(false);
            }
          }}
        >
          Tirar do carrinho
        </Button>
      )}
    </form>
  );
}
