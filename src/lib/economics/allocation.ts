/**
 * RUNNER campaign revenue allocation.
 *
 * All monetary math is done in integer USDC *cents* to avoid floating-point
 * drift. Every campaign fee is split:
 *
 *   70% → reward pool (treasury buys the approved project's token for holders)
 *   20% → platform operations
 *   10% → treasury reserve
 *
 * Rounding rule: reward and operations are floored; the reserve receives any
 * remainder so the three parts ALWAYS sum exactly to the total fee.
 */

export const ALLOCATION_BPS = {
  reward: 7_000,
  operations: 2_000,
  reserve: 1_000,
} as const;

export const BPS_DENOMINATOR = 10_000;

// Compile-time-ish guard: the split must cover exactly 100%.
if (ALLOCATION_BPS.reward + ALLOCATION_BPS.operations + ALLOCATION_BPS.reserve !== BPS_DENOMINATOR) {
  throw new Error("RUNNER allocation basis points must sum to 10,000");
}

export type CampaignPackageId = "starter" | "growth" | "featured";

export interface CampaignPackage {
  id: CampaignPackageId;
  name: string;
  feeUsdCents: number;
  /** Recommended market cap range for a coin on this package, shown to applicants. */
  recommendedMarketCap: string;
  summary: string;
  features: string[];
}

export const CAMPAIGN_PACKAGES: Record<CampaignPackageId, CampaignPackage> = {
  starter: {
    id: "starter",
    name: "Starter",
    feeUsdCents: 150_00,
    recommendedMarketCap: "$10K–$50K",
    summary: "Entry campaign for early-stage projects.",
    features: ["Full independent screening", "Listing on Explore if approved", "Standard distribution slot"],
  },
  growth: {
    id: "growth",
    name: "Growth",
    feeUsdCents: 250_00,
    recommendedMarketCap: "$50K–$100K",
    summary: "Larger reward pool and wider holder reach.",
    features: ["Full independent screening", "Priority review queue", "Expanded reward pool", "Campaign detail page"],
  },
  featured: {
    id: "featured",
    name: "Featured",
    feeUsdCents: 500_00,
    recommendedMarketCap: "$100K+",
    summary: "Homepage placement for approved campaigns.",
    features: [
      "Full independent screening",
      "Priority review queue",
      "Largest reward pool",
      "Homepage featured placement (if approved)",
    ],
  },
};

export const PACKAGE_IDS = Object.keys(CAMPAIGN_PACKAGES) as CampaignPackageId[];

export interface CampaignAllocation {
  totalUsdCents: number;
  rewardUsdCents: number;
  operationsUsdCents: number;
  reserveUsdCents: number;
}

function assertValidCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer number of cents (received ${value})`);
  }
}

/** Split a campaign fee (in USDC cents) into reward / operations / reserve. */
export function calculateCampaignAllocation(totalUsdCents: number): CampaignAllocation {
  assertValidCents(totalUsdCents, "totalUsdCents");
  const rewardUsdCents = Math.floor((totalUsdCents * ALLOCATION_BPS.reward) / BPS_DENOMINATOR);
  const operationsUsdCents = Math.floor((totalUsdCents * ALLOCATION_BPS.operations) / BPS_DENOMINATOR);
  const reserveUsdCents = totalUsdCents - rewardUsdCents - operationsUsdCents;
  return { totalUsdCents, rewardUsdCents, operationsUsdCents, reserveUsdCents };
}

/** Allocation for a named package. */
export function allocationForPackage(pkg: CampaignPackageId): CampaignAllocation {
  const def = CAMPAIGN_PACKAGES[pkg];
  if (!def) throw new RangeError(`Unknown campaign package: ${String(pkg)}`);
  return calculateCampaignAllocation(def.feeUsdCents);
}

/** Aggregate allocations across many campaigns (e.g. admin totals). */
export function sumAllocations(items: CampaignAllocation[]): CampaignAllocation {
  return items.reduce<CampaignAllocation>(
    (acc, a) => ({
      totalUsdCents: acc.totalUsdCents + a.totalUsdCents,
      rewardUsdCents: acc.rewardUsdCents + a.rewardUsdCents,
      operationsUsdCents: acc.operationsUsdCents + a.operationsUsdCents,
      reserveUsdCents: acc.reserveUsdCents + a.reserveUsdCents,
    }),
    { totalUsdCents: 0, rewardUsdCents: 0, operationsUsdCents: 0, reserveUsdCents: 0 },
  );
}

/** Verifies a stored allocation is internally consistent with the 70/20/10 rule. */
export function isAllocationConsistent(a: CampaignAllocation): boolean {
  const expected = calculateCampaignAllocation(a.totalUsdCents);
  return (
    expected.rewardUsdCents === a.rewardUsdCents &&
    expected.operationsUsdCents === a.operationsUsdCents &&
    expected.reserveUsdCents === a.reserveUsdCents
  );
}
