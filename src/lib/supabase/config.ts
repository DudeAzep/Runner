/**
 * Supabase configuration. Only the URL and the publishable/anon key are ever
 * referenced with the NEXT_PUBLIC_ prefix. The service-role key is read solely
 * inside `server-only` modules (see ./admin.ts) and is never bundled for the
 * browser.
 */
export function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicConfig() !== null && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
