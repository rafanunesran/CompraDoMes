import { describe, expect, it } from "vitest";
import { normalizeUnitPrice, packageLabel, packageUnitsFor } from "@/lib/units";

describe("normalizeUnitPrice", () => {
  it("converte gramas para preço por kg", () => {
    expect(normalizeUnitPrice(5, 500, "g", "kg")).toBe(10);
  });
  it("divide pelo peso em kg", () => {
    expect(normalizeUnitPrice(25, 5, "kg", "kg")).toBe(5);
  });
  it("converte ml para preço por litro", () => {
    expect(normalizeUnitPrice(3, 250, "ml", "l")).toBe(12);
  });
  it("divide pacotes com várias unidades", () => {
    expect(normalizeUnitPrice(12, 12, "un", "un")).toBe(1);
  });
  it("sem embalagem, devolve o preço", () => {
    expect(normalizeUnitPrice(7.5, null, null, "kg")).toBe(7.5);
  });
  it("unidades incompatíveis não são comparáveis", () => {
    expect(normalizeUnitPrice(7.5, 1, "l", "kg")).toBeNull();
  });
});

describe("helpers", () => {
  it("lista unidades compatíveis", () => {
    expect(packageUnitsFor("kg")).toEqual(["g", "kg"]);
  });
  it("formata embalagem", () => {
    expect(packageLabel(1.5, "l")).toBe("1,5L");
    expect(packageLabel(500, "g")).toBe("500g");
    expect(packageLabel(null, "g")).toBe("");
  });
});
