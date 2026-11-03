import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, getSessionSecret, verifyAdminToken } from "@/lib/auth/session-token";

/**
 * Network-boundary gate for /admin. An early redirect for visitors without a
 * valid session; the authoritative checks run again in the admin layout,
 * each admin page, and every admin server action.
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();
  const ok = await verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value, getSessionSecret());
  if (!ok) return NextResponse.redirect(new URL("/admin/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
