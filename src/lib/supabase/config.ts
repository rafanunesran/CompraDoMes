/**
 * Aceita a URL do projeto mesmo se vier com caminho extra
 * (ex.: o "RESTful endpoint" https://xxx.supabase.co/rest/v1/) ou sem https://.
 * O cliente do Supabase precisa só da origem.
 */
export function normalizeSupabaseUrl(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return value;
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).origin;
  } catch {
    return value;
  }
}

export function supabaseUrl(): string {
  return normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}
