"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo, type ReactNode } from "react";
// Vendored copy of @solana/wallet-adapter-react-ui/styles.css without its
// third-party Google Fonts @import (we use our own self-hosted fonts).
import "@/styles/wallet-adapter.css";

/**
 * Solana Wallet Adapter root.
 *
 * Wallets that implement the Wallet Standard (Phantom, Solflare, Backpack, …)
 * are discovered automatically, so the explicit adapter list is empty.
 * Wallets are asked to sign only when the user acts: a free sign-in message,
 * or a payment / treasury transaction they approve in the wallet.
 */
export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("mainnet-beta"), []);
  const wallets = useMemo(() => [], []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
