"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchRunnerBalance } from "@/app/(site)/dashboard/actions";
import { Badge, SourceBadge } from "@/components/ui/Badge";
import { estimateUsdReward } from "@/lib/economics/rewards";
import { formatInt, formatPercent, formatUsdCents } from "@/lib/format";

type BalanceResult = Awaited<ReturnType<typeof fetchRunnerBalance>>;

const EXAMPLE_BALANCE = 250_000;
const EXAMPLE_SUPPLY = 100_000_000;

/**
 * Homepage "holder share" box. Shows an illustrative example until a wallet
 * is connected, then the wallet's live RUNNER balance, share, and estimated
 * payout for this campaign.
 */
export function HolderShareBox({ rewardUsdCents, ticker }: { rewardUsdCents: number; ticker: string }) {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toBase58() ?? null;
  const [result, setResult] = useState<{ address: string; value: BalanceResult } | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchRunnerBalance(address)
      .then((value) => !cancelled && setResult({ address, value }))
      .catch(() => !cancelled && setResult({ address, value: { configured: true, ok: false, error: "Balance lookup failed" } }));
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Ignore a result that belongs to a previously connected wallet.
  const current = address && result?.address === address ? result.value : null;
  const loading = !!address && !current;
  const live = current && current.configured && current.ok ? current : null;

  let balance = EXAMPLE_BALANCE;
  let supply = EXAMPLE_SUPPLY;
  if (live) {
    balance = Math.floor(live.balance);
    // Total supply is used as the eligible supply: a conservative estimate (real share is usually a bit higher after exclusions).
    supply = Math.max(1, Math.floor(live.supply));
  }
  const est = estimateUsdReward(BigInt(balance), BigInt(supply), rewardUsdCents);
  const showNumbers = !address || !!live;

  return (
    <div className="mt-6 rounded-md border border-ink-700 bg-ink-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="label">{address ? "Your share" : "Example holder share"}</span>
        {address ? (
          <Badge tone="volt" dot>
            Wallet connected
          </Badge>
        ) : (
          <SourceBadge source="demo" />
        )}
      </div>

      {showNumbers ? (
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-fg-subtle">{address ? "Your RUNNER" : "Balance"}</div>
            <div className="tabular mt-1 font-medium">{formatInt(balance)}</div>
          </div>
          <div>
            <div className="text-xs text-fg-subtle">Share</div>
            <div className="tabular mt-1 font-medium">{formatPercent(est.percentage)}</div>
          </div>
          <div>
            <div className="text-xs text-fg-subtle">Est. payout</div>
            <div className="tabular mt-1 font-medium text-volt-400">
              {est.isBelowOneCent ? "< $0.01" : formatUsdCents(est.rewardUsdCents, { forceCents: true })}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-fg-muted">
          {loading
            ? "Reading your RUNNER balance…"
            : current && !current.configured
              ? "RUNNER isn't live yet. Your balance, share and estimated payout will show here once it launches."
              : "Couldn't read your RUNNER balance right now. Try again in a moment."}
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
        {live
          ? `Estimate based on your share of the total RUNNER supply. Payout is in $${ticker}, shown at its USD value; it can change before distribution.`
          : `Illustrative: ${formatInt(EXAMPLE_BALANCE)} of ${formatInt(EXAMPLE_SUPPLY)} eligible RUNNER. Reward is paid in $${ticker}, whose value can change.`}
      </p>

      {!address && (
        <button
          type="button"
          onClick={() => setVisible(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-volt-400 hover:text-volt-300"
        >
          <Wallet className="size-3.5" aria-hidden /> Connect wallet to see your share
        </button>
      )}
    </div>
  );
}
