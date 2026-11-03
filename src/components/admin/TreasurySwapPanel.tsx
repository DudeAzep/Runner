"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowRight, CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { executeSwapAction, prepareSwapAction, type SwapPreview } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { signWithWallet, walletErrorMessage } from "@/lib/solana/client";
import { TreasuryWalletGate } from "./TreasuryWalletGate";

/** Live treasury purchase: Jupiter quote → treasury wallet signs → server broadcasts & verifies. */
export function TreasurySwapPanel({ campaignId, treasury, ticker, remainingUsd }: { campaignId: string; treasury: string; ticker: string; remainingUsd: string }) {
  const { signTransaction } = useWallet();
  const router = useRouter();
  const [amount, setAmount] = useState(remainingUsd);
  const [preview, setPreview] = useState<SwapPreview | null>(null);
  const [busy, setBusy] = useState<"quote" | "sign" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const quote = async () => {
    setBusy("quote");
    setResult(null);
    const r = await prepareSwapAction(campaignId, amount);
    setBusy(null);
    if (r.ok && r.data) setPreview(r.data);
    else setResult({ ok: false, message: r.message });
  };

  const execute = async () => {
    if (!preview) return;
    if (!window.confirm(`Swap ${preview.usdcIn} USDC for ~${preview.tokensOut} ${ticker} from the treasury? This is a real transaction.`)) return;
    setBusy("sign");
    setResult(null);
    try {
      const signed = await signWithWallet(signTransaction, preview.transaction);
      const r = await executeSwapAction(campaignId, signed, preview.lastValidBlockHeight);
      setResult({ ok: r.ok, message: r.message });
      if (r.ok) {
        setPreview(null);
        router.refresh();
      }
    } catch (e) {
      setResult({ ok: false, message: walletErrorMessage(e) });
    }
    setBusy(null);
  };

  return (
    <TreasuryWalletGate treasury={treasury}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="sr-only">USDC amount</span>
            <input
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setPreview(null);
              }}
              inputMode="decimal"
              className="field tabular font-mono"
              placeholder="USDC amount"
            />
          </label>
          <Button variant="secondary" onClick={quote} disabled={busy !== null}>
            {busy === "quote" && <LoaderCircle className="size-4 animate-spin" />} Get quote
          </Button>
        </div>
        {preview && (
          <div className="rounded-md border border-ink-600 bg-ink-900 p-3 text-sm">
            <div className="tabular flex items-center gap-2 font-medium">
              {preview.usdcIn} USDC <ArrowRight className="size-3.5 text-fg-subtle" /> ~{preview.tokensOut} {ticker}
            </div>
            <dl className="tabular mt-2 grid grid-cols-2 gap-1 text-xs text-fg-muted">
              <dt>Minimum received</dt>
              <dd className="text-right">
                {preview.minTokensOut} {ticker}
              </dd>
              <dt>Price impact</dt>
              <dd className={`text-right ${Number(preview.priceImpactPct) > 0.02 ? "text-amber-400" : ""}`}>{(Number(preview.priceImpactPct) * 100).toFixed(2)}%</dd>
              <dt>Route</dt>
              <dd className="truncate text-right">{preview.route || "—"}</dd>
            </dl>
            <Button className="mt-3 w-full" variant="volt" onClick={execute} disabled={busy !== null}>
              {busy === "sign" && <LoaderCircle className="size-4 animate-spin" />}
              {busy === "sign" ? "Sign in wallet & confirming…" : "Sign & execute purchase"}
            </Button>
          </div>
        )}
        {result && (
          <p role="status" className={`flex items-start gap-1.5 text-xs ${result.ok ? "text-volt-400" : "text-rose-400"}`}>
            {result.ok ? <CircleCheck className="mt-px size-3.5 shrink-0" /> : <CircleX className="mt-px size-3.5 shrink-0" />}
            {result.message}
          </p>
        )}
      </div>
    </TreasuryWalletGate>
  );
}
