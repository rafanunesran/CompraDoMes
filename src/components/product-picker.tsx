"use client";

import { useId, useState, type FormEvent } from "react";
import { CATEGORIES } from "@/lib/categories";
import { findProduct } from "@/lib/db";
import type { Product } from "@/lib/types";
import { BASE_UNITS, type BaseUnit } from "@/lib/units";
import { Button, Input, Select } from "./ui";

export interface PickedProduct {
  name: string;
  existing?: Product;
  category: string;
  baseUnit: BaseUnit;
  quantity: number;
}

/**
 * Campo de texto com autocomplete do catálogo. Se o nome for novo,
 * pede categoria e unidade para cadastrar o produto genérico.
 */
export function ProductPicker({
  products,
  onPick,
  submitLabel = "Adicionar",
  autoFocus,
}: {
  products: Product[];
  onPick: (p: PickedProduct) => Promise<void> | void;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState<string>("Mercearia");
  const [baseUnit, setBaseUnit] = useState<BaseUnit>("un");
  const [busy, setBusy] = useState(false);
  const existing = name.trim() ? findProduct(products, name) : undefined;
  const isNew = name.trim().length > 0 && !existing;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onPick({
        name,
        existing,
        category: existing?.category ?? category,
        baseUnit: existing?.base_unit ?? baseUnit,
        quantity,
      });
      setName("");
      setQuantity(1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          list={listId}
          placeholder="Ex.: Arroz, Leite, Detergente…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={autoFocus}
          aria-label="Produto"
        />
        <Input
          type="number"
          inputMode="decimal"
          min={0.001}
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value) || 1)}
          className="w-20 text-center"
          aria-label="Quantidade"
        />
      </div>
      <datalist id={listId}>
        {products.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      {isNew && (
        <div className="grid grid-cols-2 gap-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select
            value={baseUnit}
            onChange={(e) => setBaseUnit(e.target.value as BaseUnit)}
            aria-label="Comparar preço por"
          >
            {BASE_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                preço por {u.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Button type="submit" disabled={busy || !name.trim()}>
        {isNew ? `Criar "${name.trim()}" e ${submitLabel.toLowerCase()}` : submitLabel}
      </Button>
    </form>
  );
}
