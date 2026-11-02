import { calculateHolderReward, fromBaseUnits, toBaseUnits } from "@/lib/economics/rewards";
import type { Campaign, CampaignFilter, CampaignSort, Distribution, TreasuryPurchase } from "@/lib/types";
import { RepositoryError } from "./repository";

/** Decimal precision used when summing simulated token amounts. */
export const TOKEN_CALC_DECIMALS = 9;

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Human-friendly, unguessable application reference, e.g. RUN-7Q4K2M. */
export function generateReference(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length];
  return `RUN-${out}`;
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "campaign"
  );
}

export function filterAndSortCampaigns(
  campaigns: Campaign[],
  { filter = "all", sort = "recent", search }: { filter?: CampaignFilter; sort?: CampaignSort; search?: string } = {},
): Campaign[] {
  let list = campaigns.filter((c) => c.status !== "cancelled");
  if (filter === "approved") list = list.filter((c) => c.status === "active");
  if (filter === "upcoming") list = list.filter((c) => c.status === "upcoming");
  if (filter === "completed") list = list.filter((c) => c.status === "completed");
  if (search) {
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) => c.projectName.toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q) || c.tokenAddress.toLowerCase() === q,
      );
    }
  }
  const sorted = [...list];
  if (sort === "recent") sorted.sort((a, b) => Date.parse(b.screeningDate) - Date.parse(a.screeningDate));
  if (sort === "market_cap") sorted.sort((a, b) => (b.marketCapAtScreeningUsd ?? -1) - (a.marketCapAtScreeningUsd ?? -1));
  if (sort === "allocation") sorted.sort((a, b) => b.rewardAllocationCents - a.rewardAllocationCents);
  return sorted;
}

export function totalPurchasedTokens(purchases: TreasuryPurchase[]): bigint {
  return purchases.reduce((sum, p) => sum + toBaseUnits(p.tokenAmount, TOKEN_CALC_DECIMALS), 0n);
}

export function sumDistributedTokens(distributions: Distribution[]): bigint {
  return distributions.reduce((sum, d) => sum + toBaseUnits(d.rewardAmount, TOKEN_CALC_DECIMALS), 0n);
}

/**
 * Computes a single holder distribution row for a campaign, enforcing:
 * - eligible supply recorded on the campaign (snapshot taken)
 * - a recorded treasury purchase (reward pool exists)
 * - holder balance ≤ eligible supply
 * - no duplicate wallet per campaign
 * - total distributed never exceeds the reward pool
 */
export function computeDistributionRow(args: {
  campaign: Campaign;
  purchases: TreasuryPurchase[];
  existing: Distribution[];
  walletAddress: string;
  runnerBalance: string;
}): Omit<Distribution, "id" | "createdAt" | "source"> {
  const { campaign, purchases, existing, walletAddress, runnerBalance } = args;
  if (!campaign.eligibleSupply) {
    throw new RepositoryError("Record the eligible RUNNER supply (snapshot) on the campaign before recording distributions.", "invalid_state");
  }
  const pool = totalPurchasedTokens(purchases);
  if (pool <= 0n) throw new RepositoryError("Record a treasury purchase before recording distributions.", "invalid_state");
  if (existing.some((d) => d.walletAddress === walletAddress)) {
    throw new RepositoryError("This wallet already has a distribution recorded for this campaign.", "conflict");
  }
  const supply = BigInt(campaign.eligibleSupply);
  const balance = BigInt(runnerBalance);
  if (balance <= 0n) throw new RepositoryError("RUNNER balance must be greater than zero.", "invalid_state");
  if (balance > supply) throw new RepositoryError("RUNNER balance cannot exceed the eligible supply.", "invalid_state");

  const r = calculateHolderReward({ holderBalance: balance, eligibleSupply: supply, rewardPool: pool });
  if (sumDistributedTokens(existing) + r.rewardAmount > pool) {
    throw new RepositoryError("Recording this distribution would exceed the campaign reward pool.", "invalid_state");
  }
  return {
    campaignId: campaign.id,
    walletAddress,
    runnerBalance: balance.toString(),
    eligibleSupply: supply.toString(),
    rewardPercentage: r.percentage,
    rewardAmount: fromBaseUnits(r.rewardAmount, TOKEN_CALC_DECIMALS),
    distributionStatus: "simulated",
    transactionSignature: null,
  };
}
