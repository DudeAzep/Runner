import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, getSessionSecret, verifyAdminToken } from "./session-token";

export interface AdminSession {
  id: string;
  label: string;
}

/**
 * Server-side admin authorization — the single source of truth.
 * Called by the admin layout, every admin page, and every admin server
 * action. Hiding UI is never relied upon for security.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const payload = await verifyAdminToken(token, getSessionSecret());
  return payload ? { id: payload.sub, label: payload.sub } : null;
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
