import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "./config";

/**
 * Session-aware client (acts as the signed-in user; RLS applies).
 * Create a new one per request — never share across requests.
 */
export async function createSupabaseSessionClient(): Promise<SupabaseClient> {
  const cfg = getSupabasePublicConfig();
  if (!cfg) throw new Error("Supabase is not configured");
  const cookieStore = await cookies();
  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component where cookies are read-only; the
          // proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Anonymous client (no session) for public, RLS-protected reads. */
export function createSupabasePublicClient(): SupabaseClient {
  const cfg = getSupabasePublicConfig();
  if (!cfg) throw new Error("Supabase is not configured");
  return createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
