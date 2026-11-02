"use server";

import { getRepository } from "@/lib/data";
import { isValidSolanaAddress } from "@/lib/validation/solana";

/**
 * Returns recorded distributions for a wallet. For a real connected wallet in
 * the MVP this is expected to be empty — RUNNER never implies rewards were
 * received unless a distribution record exists.
 */
export async function fetchWalletDistributions(wallet: string) {
  if (!isValidSolanaAddress(wallet)) return { ok: false as const, error: "Invalid wallet address", items: [] };
  const items = await getRepository().getWalletDistributions(wallet);
  return {
    ok: true as const,
    items: items.map((d) => ({
      id: d.id,
      projectName: d.campaign.projectName,
      ticker: d.campaign.ticker,
      slug: d.campaign.slug,
      rewardAmount: d.rewardAmount,
      rewardPercentage: d.rewardPercentage,
      runnerBalance: d.runnerBalance,
      status: d.distributionStatus,
      signature: d.transactionSignature,
      createdAt: d.createdAt,
      source: d.source,
    })),
  };
}

export type WalletDistributionItem = Awaited<ReturnType<typeof fetchWalletDistributions>>["items"][number];
