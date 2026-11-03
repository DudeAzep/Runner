"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { shortenAddress } from "@/lib/validation/solana";

/** Renders children only when the connected wallet IS the configured treasury wallet. */
export function TreasuryWalletGate({ treasury, children }: { treasury: string; children: ReactNode }) {
  const { publicKey } = useWallet();
  if (!publicKey) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-ink-600 bg-ink-900 p-3 text-sm text-fg-muted">
        <span>
          Connect the treasury wallet <span className="font-mono text-fg">{shortenAddress(treasury, 5)}</span> to sign.
        </span>
        <WalletConnectButton />
      </div>
    );
  }
  if (publicKey.toBase58() !== treasury) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-400">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <span>
          Connected wallet {shortenAddress(publicKey.toBase58(), 5)} is not the treasury ({shortenAddress(treasury, 5)}). Switch accounts in your
          wallet.
        </span>
      </div>
    );
  }
  return <>{children}</>;
}
