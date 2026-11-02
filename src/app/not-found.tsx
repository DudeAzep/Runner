import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <LogoMark size={40} />
      <p className="mt-6 font-mono text-sm text-violet-300">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page ran off.</h1>
      <p className="mt-2 text-sm text-fg-muted">The page or campaign you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/explore" className="mt-6 text-sm text-violet-300 hover:text-violet-200">
        Explore campaigns →
      </Link>
    </div>
  );
}
