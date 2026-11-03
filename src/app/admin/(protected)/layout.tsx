import { ExternalLink, LogOut, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { Logo } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/Badge";
import { SolanaWalletProvider } from "@/components/wallet/SolanaWalletProvider";
import { requireAdminPage } from "@/lib/auth/admin";
import { logoutAction } from "../login/actions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · RUNNER Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  // Authoritative server-side check. Unauthenticated requests never render admin UI.
  const session = await requireAdminPage();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-ink-700 bg-ink-950 p-4 lg:sticky lg:top-0 lg:h-dvh lg:self-start lg:border-b-0 lg:border-r lg:p-5">
        <div className="flex items-center justify-between lg:block">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo />
          </Link>
          <Badge tone="violet" className="lg:mt-4">
            <ShieldCheck className="size-3" /> Admin
          </Badge>
        </div>
        <div className="mt-4 lg:mt-8">
          <AdminNav />
        </div>
        <div className="mt-4 hidden space-y-3 border-t border-ink-700 pt-4 lg:absolute lg:inset-x-5 lg:bottom-5 lg:block">
          <div className="text-xs text-fg-subtle">
            Signed in as <span className="text-fg-muted">{session.label}</span>
            <div className="mt-0.5">Local database</div>
          </div>
          <Link href="/" className="flex items-center gap-2 text-sm text-fg-muted hover:text-fg">
            <ExternalLink className="size-4" /> View site
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="flex items-center gap-2 text-sm text-fg-muted hover:text-rose-400">
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="flex items-center justify-end gap-4 border-b border-ink-700 px-4 py-2 text-xs lg:hidden">
          <span className="text-fg-subtle">{session.label}</span>
          <form action={logoutAction}>
            <button type="submit" className="text-fg-muted hover:text-rose-400">
              Sign out
            </button>
          </form>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <SolanaWalletProvider>{children}</SolanaWalletProvider>
        </main>
      </div>
    </div>
  );
}
