import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl } from "@/lib/supabase/config";

describe("normalizeSupabaseUrl", () => {
  it("remove o caminho /rest/v1/", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co");
  });
  it("remove barra final e espaços", () => {
    expect(normalizeSupabaseUrl("  https://abc.supabase.co/ ")).toBe("https://abc.supabase.co");
  });
  it("adiciona https:// quando falta", () => {
    expect(normalizeSupabaseUrl("abc.supabase.co")).toBe("https://abc.supabase.co");
  });
  it("mantém URL local com porta", () => {
    expect(normalizeSupabaseUrl("http://localhost:54321")).toBe("http://localhost:54321");
  });
});
