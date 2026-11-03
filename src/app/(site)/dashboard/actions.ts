"use server";

import { getConfig } from "@/lib/config";
import { getRepository } from "@/lib/data";
import { fromBaseUnits } from "@/lib/economics/rewards";
import { getMintInfo, getTokenBalance } from "@/lib/solana/server";
import { isValidSolanaAddress } from "@/lib/validation/solana";

/**
 * Returns recorded distributions for a wallet. For a real connected wallet in
 * the MVP this is expected to be empty — RUNNER never implies rewards were
 * received unless a distribution record exists.
 */
export async function fetchWalletDistributions(wallet: string) {
  if (!isValidSolanaAddress(wallet)) return { ok: false as const, error: "Invalid wallet address", items: [] };
  const items = getRepository().getWalletDistributions(wallet);
  return {
    ok: true as const,
    items: items.map((d) => ({
      id: d.id,
      projectName: d.campaign.projectName,
      ticker: d.campaign.ticker,
      slug: d.campaign.slug,
      rewardAmount: d.rewardAmount,
      rewardPercentage: d.rewardPercentage,
      runnerBalance: fromBaseUnits(BigInt(d.runnerBalance), d.runnerDecimals, 2),
      status: d.distributionStatus,
      signature: d.transactionSignature,
      createdAt: d.createdAt,
      source: d.source,
    })),
  };
}

export type WalletDistributionItem = Awaited<ReturnType<typeof fetchWalletDistributions>>["items"][number];

/** Live RUNNER balance for a wallet (requires RUNNER_MINT). Read-only RPC lookup on the server. */
export async function fetchRunnerBalance(wallet: string): Promise<
  { configured: false } | { configured: true; ok: true; balance: number; supply: number } | { configured: true; ok: false; error: string }
> {
  const cfg = getConfig();
  if (!cfg.runnerMint) return { configured: false };
  if (!isValidSolanaAddress(wallet)) return { configured: true, ok: false, error: "Invalid wallet address" };
  try {
    const [bal, mint] = await Promise.all([getTokenBalance(wallet, cfg.runnerMint), getMintInfo(cfg.runnerMint)]);
    const scale = 10 ** mint.decimals;
    return { configured: true, ok: true, balance: Number(bal.raw) / scale, supply: Number(BigInt(mint.supply)) / scale };
  } catch (e) {
    return { configured: true, ok: false, error: e instanceof Error ? e.message : "Balance lookup failed" };
  }
}
