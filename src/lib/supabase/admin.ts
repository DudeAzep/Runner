import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

/**
 * Service-role client. BYPASSES RLS.
 *
 * - Importing this file from a Client Component fails the build ("server-only").
 * - SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix, so Next.js never
 *   inlines it into browser bundles.
 * - Use only for narrowly-scoped server operations that have already been
 *   validated (e.g. public application intake).
 */
export function createSupabaseServiceClient(): SupabaseClient {
  const cfg = getSupabasePublicConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cfg || !serviceKey) throw new Error("Supabase service role is not configured");
  return createClient(cfg.url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
