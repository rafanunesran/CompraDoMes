import { describe, expect, it } from "vitest";
import { monthKey, parseDecimal, shiftMonth } from "@/lib/format";

describe("parseDecimal", () => {
  it("aceita vírgula", () => expect(parseDecimal("5,99")).toBe(5.99));
  it("aceita ponto", () => expect(parseDecimal("5.99")).toBe(5.99));
  it("aceita milhar e símbolo", () => expect(parseDecimal("R$ 1.234,56")).toBe(1234.56));
  it("vazio é null", () => expect(parseDecimal("")).toBeNull());
});

describe("meses", () => {
  it("gera a chave do mês", () => expect(monthKey(new Date(2026, 9, 15))).toBe("2026-10-01"));
  it("volta um mês atravessando o ano", () => expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01"));
});
