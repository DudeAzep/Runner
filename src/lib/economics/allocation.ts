/**
 * RUNNER campaign revenue allocation.
 *
 * All monetary math is done in integer USDC *cents* to avoid floating-point
 * drift. Each package splits its fee into a reward pool, operations, and a
 * reserve. Bigger packages put more of the fee into the reward pool:
 *
 *   Starter   70% reward / 20%  operations / 10%  reserve
 *   Growth    80% reward / 15%  operations /  5%  reserve
 *   Featured  90% reward / 7.5% operations / 2.5% reserve
 *
 * Rounding rule: reward and operations are floored; the reserve receives any
 * remainder so the three parts ALWAYS sum exactly to the total fee.
 */

/** A split in basis points (10,000 = 100%). */
export interface AllocationBps {
  reward: number;
  operations: number;
  reserve: number;
}

/** The base (Starter) split. Also the default for fees with no package. */
export const ALLOCATION_BPS: AllocationBps = {
  reward: 7_000,
  operations: 2_000,
  reserve: 1_000,
};

export const BPS_DENOMINATOR = 10_000;

export type CampaignPackageId = "starter" | "growth" | "featured";

export interface CampaignPackage {
  id: CampaignPackageId;
  name: string;
  feeUsdCents: number;
  /** How this package's fee is split. */
  allocationBps: AllocationBps;
  /** Recommended market cap range for a coin on this package, shown to applicants. */
  recommendedMarketCap: string;
  summary: string;
  features: string[];
}

export const CAMPAIGN_PACKAGES: Record<CampaignPackageId, CampaignPackage> = {
  starter: {
    id: "starter",
    name: "Starter",
    feeUsdCents: 500_00,
    allocationBps: ALLOCATION_BPS,
    recommendedMarketCap: "$10K–$50K",
    summary: "Entry campaign for early-stage projects.",
    features: ["Full independent screening", "Listing on Explore if approved", "Standard distribution slot"],
  },
  growth: {
    id: "growth",
    name: "Growth",
    feeUsdCents: 750_00,
    allocationBps: { reward: 8_000, operations: 1_500, reserve: 500 },
    recommendedMarketCap: "$50K–$100K",
    summary: "Larger reward pool and wider holder reach.",
    features: ["Full independent screening", "Priority review queue", "80% of the fee goes to rewards", "Campaign detail page"],
  },
  featured: {
    id: "featured",
    name: "Featured",
    feeUsdCents: 2_000_00,
    allocationBps: { reward: 9_000, operations: 750, reserve: 250 },
    recommendedMarketCap: "$100K+",
    summary: "Homepage placement for approved campaigns.",
    features: [
      "Full independent screening",
      "Priority review queue",
      "90% of the fee goes to rewards",
      "Homepage featured placement (if approved)",
    ],
  },
};

export const PACKAGE_IDS = Object.keys(CAMPAIGN_PACKAGES) as CampaignPackageId[];

// Guard: every split must cover exactly 100%.
for (const p of [ALLOCATION_BPS, ...PACKAGE_IDS.map((id) => CAMPAIGN_PACKAGES[id].allocationBps)]) {
  if (p.reward + p.operations + p.reserve !== BPS_DENOMINATOR) throw new Error("RUNNER allocation basis points must sum to 10,000");
}

/** Basis points as a display percentage, e.g. 750 -> 7.5. */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

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

/** Split a campaign fee (in USDC cents) into reward / operations / reserve. Defaults to the base 70/20/10 split. */
export function calculateCampaignAllocation(totalUsdCents: number, bps: AllocationBps = ALLOCATION_BPS): CampaignAllocation {
  assertValidCents(totalUsdCents, "totalUsdCents");
  const rewardUsdCents = Math.floor((totalUsdCents * bps.reward) / BPS_DENOMINATOR);
  const operationsUsdCents = Math.floor((totalUsdCents * bps.operations) / BPS_DENOMINATOR);
  const reserveUsdCents = totalUsdCents - rewardUsdCents - operationsUsdCents;
  return { totalUsdCents, rewardUsdCents, operationsUsdCents, reserveUsdCents };
}

/** Allocation for a named package. */
export function allocationForPackage(pkg: CampaignPackageId): CampaignAllocation {
  const def = CAMPAIGN_PACKAGES[pkg];
  if (!def) throw new RangeError(`Unknown campaign package: ${String(pkg)}`);
  return calculateCampaignAllocation(def.feeUsdCents, def.allocationBps);
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

/** Verifies a stored allocation is internally consistent with a split (default: the base 70/20/10). */
export function isAllocationConsistent(a: CampaignAllocation, bps: AllocationBps = ALLOCATION_BPS): boolean {
  const expected = calculateCampaignAllocation(a.totalUsdCents, bps);
  return (
    expected.rewardUsdCents === a.rewardUsdCents &&
    expected.operationsUsdCents === a.operationsUsdCents &&
    expected.reserveUsdCents === a.reserveUsdCents
  );
}
