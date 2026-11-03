"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { CheckCircle2, ExternalLink, LoaderCircle, ShieldCheck, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { preparePayment, submitPayment, verifyPaymentSignature } from "@/app/(site)/submit/actions";
import { Button } from "@/components/ui/Button";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { signWithWallet, walletErrorMessage } from "@/lib/solana/client";

type Step = "idle" | "preparing" | "signing" | "confirming" | "done";

/**
 * Real USDC payment for an application. The server builds the transfer
 * (with a "RUNNER:<reference>" memo), the user's wallet signs it, and the
 * server broadcasts and verifies it on-chain before marking the fee paid.
 */
export function PayWithWallet({ reference, amountUsd, cluster }: { reference: string; amountUsd: string; cluster: "mainnet-beta" | "devnet" }) {
  const { publicKey, signTransaction } = useWallet();
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sig, setSig] = useState("");

  const pay = async () => {
    if (!publicKey) return;
    setError(null);
    try {
      setStep("preparing");
      const prep = await preparePayment(reference, publicKey.toBase58());
      if (!prep.ok || !prep.data) throw new Error(prep.message);
      setStep("signing");
      const signed = await signWithWallet(signTransaction, prep.data.transaction);
      setStep("confirming");
      const res = await submitPayment(reference, signed, prep.data.blockhash, prep.data.lastValidBlockHeight);
      if (!res.ok) throw new Error(res.message);
      setMessage(res.message);
      setStep("done");
      router.refresh();
    } catch (e) {
      setError(walletErrorMessage(e));
      setStep("idle");
    }
  };

  const verifyExisting = async () => {
    setError(null);
    setStep("confirming");
    const res = await verifyPaymentSignature(reference, sig);
    if (res.ok) {
      setMessage(res.message);
      setStep("done");
      router.refresh();
    } else {
      setError(res.message);
      setStep("idle");
    }
  };

  if (step === "done") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-md border border-volt-400/30 bg-volt-400/10 p-4 text-sm text-volt-400">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        {message}
      </div>
    );
  }

  const busy = step !== "idle";
  return (
    <div className="rounded-lg border border-violet-500/40 bg-violet-500/[0.06] p-5">
      <div className="flex items-center gap-2">
        <Wallet className="size-4 text-violet-300" />
        <h3 className="text-[15px] font-semibold">Pay campaign fee · {amountUsd} USDC</h3>
        {cluster === "devnet" && <span className="rounded-sm border border-amber-400/30 px-1.5 text-[11px] text-amber-400">DEVNET</span>}
      </div>
      <p className="mt-2 text-sm text-fg-muted">
        Your wallet will ask you to approve a USDC transfer to the RUNNER treasury, tagged with reference{" "}
        <span className="font-mono text-fg">{reference}</span>. Paying does not guarantee approval.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {publicKey ? (
          <Button onClick={pay} disabled={busy}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {step === "preparing" ? "Preparing…" : step === "signing" ? "Approve in wallet…" : step === "confirming" ? "Confirming on-chain…" : `Pay ${amountUsd} USDC`}
          </Button>
        ) : (
          <WalletConnectButton size="md" />
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-400">
          {error}
        </p>
      )}
      <details className="mt-4 text-sm text-fg-muted">
        <summary className="cursor-pointer select-none text-xs text-fg-subtle hover:text-fg">Already paid? Verify by transaction signature</summary>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input value={sig} onChange={(e) => setSig(e.target.value)} placeholder="Transaction signature" className="field font-mono text-xs" aria-label="Transaction signature" />
          <Button variant="secondary" onClick={verifyExisting} disabled={busy || !sig.trim()}>
            Verify <ExternalLink className="size-3.5" />
          </Button>
        </div>
      </details>
    </div>
  );
}
