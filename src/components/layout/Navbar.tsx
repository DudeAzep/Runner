"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/submit", label: "Submit Project" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-200",
        scrolled || open ? "border-ink-700 bg-ink-900/85 backdrop-blur-xl" : "border-transparent bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8" aria-label="Main">
        <Link href="/" aria-label="RUNNER home" className="flex shrink-0 items-center">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={cn(
                  "relative rounded-md px-3 py-2 text-sm transition-colors",
                  isActive(n.href) ? "text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {n.label}
                {isActive(n.href) && <span className="absolute inset-x-3 -bottom-[17px] h-px bg-violet-400" aria-hidden />}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden md:block">
          <WalletConnectButton />
        </div>

        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-md border border-ink-600 text-fg-muted md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-ink-700 px-4 pb-5 pt-2 md:hidden">
          <ul className="flex flex-col">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className={cn("block rounded-md px-3 py-3 text-[15px]", isActive(n.href) ? "bg-ink-800 text-fg" : "text-fg-muted")}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <WalletConnectButton size="md" className="mt-3 w-full" />
        </div>
      )}
    </header>
  );
}
