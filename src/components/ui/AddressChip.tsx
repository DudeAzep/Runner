"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { shortenAddress, solscanAccountUrl, solscanTokenUrl } from "@/lib/validation/solana";

export function AddressChip({
  address,
  kind = "account",
  full = false,
  explorer = true,
  className,
}: {
  address: string;
  kind?: "token" | "account";
  full?: boolean;
  explorer?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 rounded-sm border border-ink-600 bg-ink-900 pl-2 font-mono text-xs text-fg-muted", className)}>
      <span className={cn(full ? "break-all" : "truncate")} title={address}>
        {full ? address : shortenAddress(address, 5)}
      </span>
      <button type="button" onClick={copy} className="p-1.5 text-fg-subtle transition hover:text-fg" aria-label="Copy address">
        {copied ? <Check className="size-3.5 text-volt-400" /> : <Copy className="size-3.5" />}
      </button>
      {explorer && (
        <a
          href={kind === "token" ? solscanTokenUrl(address) : solscanAccountUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="border-l border-ink-600 p-1.5 text-fg-subtle transition hover:text-fg"
          aria-label="View on Solscan"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </span>
  );
}
