import { toBaseUnits } from "@/lib/economics/rewards";
import type { Campaign, CampaignFilter, CampaignSort, Distribution, TreasuryPurchase } from "@/lib/types";

/** Default reward-token decimals for simulated purchases where the real mint is unknown. */
export const DEFAULT_REWARD_DECIMALS = 9;

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
  // "Approved" = passed screening and not finished: live now or scheduled to start.
  if (filter === "approved") list = list.filter((c) => c.status === "active" || c.status === "upcoming");
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

/** Total reward-token pool from purchases, in base units of `decimals`. */
export function totalPurchasedTokens(purchases: TreasuryPurchase[], decimals: number): bigint {
  return purchases.reduce((sum, p) => sum + toBaseUnits(truncateDecimals(p.tokenAmount, decimals), decimals), 0n);
}

function truncateDecimals(amount: string, decimals: number): string {
  const [w, f = ""] = amount.split(".");
  const frac = f.slice(0, decimals);
  return frac ? `${w}.${frac}` : (w ?? "0");
}

export function sumRewardsRaw(distributions: Distribution[], statuses?: Distribution["distributionStatus"][]): bigint {
  return distributions
    .filter((d) => !statuses || statuses.includes(d.distributionStatus))
    .reduce((sum, d) => sum + BigInt(d.rewardAmountRaw), 0n);
}
