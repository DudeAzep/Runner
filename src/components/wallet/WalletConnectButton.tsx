"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ChevronDown, Copy, LayoutDashboard, LogOut, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { shortenAddress } from "@/lib/validation/solana";

export function WalletConnectButton({ className, size = "sm" }: { className?: string; size?: "sm" | "md" }) {
  const { publicKey, wallet, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!publicKey) {
    return (
      <button type="button" onClick={() => setVisible(true)} disabled={connecting} className={buttonClasses("primary", size, className)}>
        <Wallet className="size-4" aria-hidden />
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  const address = publicKey.toBase58();
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={buttonClasses("secondary", size, "w-full font-mono")}
      >
        {wallet?.adapter.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wallet.adapter.icon} alt="" className="size-4" />
        ) : (
          <span className="size-2 rounded-full bg-volt-400" aria-hidden />
        )}
        {shortenAddress(address)}
        <ChevronDown className="size-3.5 text-fg-subtle" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="surface absolute right-0 z-50 mt-2 w-56 p-1.5 shadow-2xl shadow-black/60">
          <div className="px-2.5 py-2 text-[11px] text-fg-subtle">Connected · {wallet?.adapter.name}</div>
          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-fg-muted hover:bg-ink-750 hover:text-fg"
            onClick={() => {
              void navigator.clipboard?.writeText(address);
              setOpen(false);
            }}
          >
            <Copy className="size-4" /> Copy address
          </button>
          <Link
            role="menuitem"
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-fg-muted hover:bg-ink-750 hover:text-fg"
          >
            <LayoutDashboard className="size-4" /> Dashboard
          </Link>
          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-rose-400 hover:bg-rose-400/10"
            onClick={() => {
              setOpen(false);
              void disconnect();
            }}
          >
            <LogOut className="size-4" /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
