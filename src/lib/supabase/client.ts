import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "./config";

let client: SupabaseClient | undefined;

/** Cliente do navegador (singleton). Só chame dentro de efeitos/handlers. */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      supabaseUrl(),
      supabaseKey(),
    );
  }
  return client;
}
