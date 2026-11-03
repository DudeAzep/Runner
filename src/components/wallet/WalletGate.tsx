"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { KeyRound, LoaderCircle, LogOut, ShieldCheck, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { finishWalletSignIn, signOutWallet, startWalletSignIn } from "@/app/(site)/wallet-actions";
import { Button } from "@/components/ui/Button";
import { walletErrorMessage } from "@/lib/solana/client";
import { shortenAddress } from "@/lib/validation/solana";

/**
 * Shows its children only to a visitor who has signed in with their Solana
 * wallet. `sessionWallet` comes from the server (the signed cookie), so the
 * gate can't be bypassed from the browser; the server re-checks on every action.
 */
export function WalletGate({
  sessionWallet,
  title,
  description,
  children,
}: {
  sessionWallet: string | null;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { publicKey, signMessage, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = publicKey?.toBase58() ?? null;

  const signIn = async () => {
    if (!connected) return setVisible(true);
    if (!signMessage) return setError("This wallet can't sign messages. Try Phantom, Solflare, or Backpack.");
    setBusy(true);
    setError(null);
    try {
      const start = await startWalletSignIn(connected);
      if (!start.ok) throw new Error(start.message);
      const sig = await signMessage(new TextEncoder().encode(start.message));
      const done = await finishWalletSignIn(connected, start.issuedAt, bs58.encode(sig));
      if (!done.ok) throw new Error(done.message);
      router.refresh();
    } catch (e) {
      setError(walletErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    await signOutWallet();
    setBusy(false);
    router.refresh();
  };

  if (sessionWallet) {
    const mismatch = connected && connected !== sessionWallet;
    return (
      <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-volt-400/25 bg-volt-400/[0.05] px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-fg-muted">
            <ShieldCheck className="size-4 text-volt-400" aria-hidden />
            Signed in as <span className="font-mono text-fg">{shortenAddress(sessionWallet)}</span>
          </span>
          <span className="flex items-center gap-2">
            {mismatch && (
              <Button size="sm" variant="secondary" onClick={signIn} disabled={busy}>
                Switch to {shortenAddress(connected)}
              </Button>
            )}
            <button type="button" onClick={signOut} disabled={busy} className="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg">
              <LogOut className="size-3.5" aria-hidden /> Sign out
            </button>
          </span>
        </div>
        {error && <p className="-mt-3 mb-6 text-sm text-rose-400">{error}</p>}
        {children}
      </>
    );
  }

  return (
    <div className="surface flex flex-col items-center px-6 py-14 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-md border border-ink-600 bg-ink-850">
        <KeyRound className="size-5 text-violet-300" aria-hidden />
      </span>
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-fg-muted">{description}</p>
      <div className="mt-6">
        {connected ? (
          <Button onClick={signIn} disabled={busy}>
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
            Sign in as {shortenAddress(connected)}
          </Button>
        ) : (
          <Button onClick={() => setVisible(true)} disabled={connecting}>
            <Wallet className="size-4" aria-hidden /> Connect wallet
          </Button>
        )}
      </div>
      <p className="mt-4 max-w-sm text-xs text-fg-subtle">
        Signing in asks your wallet to sign a short message. It&apos;s free: no transaction is sent and nothing is charged.
      </p>
      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
