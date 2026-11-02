import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseSessionClient } from "@/lib/supabase/server";
import { ADMIN_COOKIE, getSessionSecret, verifyAdminToken } from "./session-token";

export interface AdminSession {
  id: string;
  label: string;
  mode: "supabase" | "demo";
}

/**
 * Server-side admin authorization — the single source of truth.
 * Called by the admin layout AND by every admin server action. Hiding UI is
 * never relied upon for security.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseSessionClient();
    const { data, error } = await supabase.auth.getUser(); // verifies the JWT with Supabase
    if (error || !data.user) return null;
    const { data: row } = await supabase.from("users").select("id, role").eq("auth_user_id", data.user.id).maybeSingle();
    if (!row || row.role !== "admin") return null;
    return { id: row.id as string, label: data.user.email ?? "admin", mode: "supabase" };
  }

  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const payload = await verifyAdminToken(token, getSessionSecret());
  return payload ? { id: payload.sub, label: payload.sub, mode: "demo" } : null;
}

/** For pages/layouts: redirects to the login page when not authorized. */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** For server actions: throws when not authorized. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new UnauthorizedError();
  return session;
}
