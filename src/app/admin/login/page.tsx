import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Logo } from "@/components/brand/Logo";
import { getAdminSession } from "@/lib/auth/admin";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  await connection();
  if (await getAdminSession()) redirect("/admin");
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4">
      <div aria-hidden className="grid-bg absolute inset-0" />
      <div className="surface relative w-full max-w-sm p-7">
        <Link href="/" aria-label="RUNNER home">
          <Logo />
        </Link>
        <div className="mt-8 flex items-center gap-2">
          <Lock className="size-4 text-violet-400" />
          <h1 className="text-lg font-semibold">Admin sign in</h1>
        </div>
        <p className="mt-1.5 text-sm text-fg-muted">
          Use the username and password from your <code className="font-mono text-xs">.env.local</code> file (created by{" "}
          <code className="font-mono text-xs">npm run setup</code>).
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
