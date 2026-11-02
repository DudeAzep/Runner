import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, getSessionSecret, verifyAdminToken } from "@/lib/auth/session-token";

/**
 * Network-boundary gate for /admin. This is an optimistic first check that
 * redirects unauthenticated visitors early; the authoritative check is
 * `getAdminSession()` in the admin layout and in every admin server action.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseMode = Boolean(url && anon && process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (supabaseMode) {
    let response = NextResponse.next({ request });
    const supabase = createServerClient(url!, anon!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data } = await supabase.auth.getUser(); // refreshes the session cookie if needed
    if (!data.user) return NextResponse.redirect(new URL("/admin/login", request.url));
    return response;
  }

  const ok = await verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value, getSessionSecret());
  if (!ok) return NextResponse.redirect(new URL("/admin/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
