/**
 * Proportional holder reward math.
 *
 *   reward_percentage = holder_eligible_balance / total_eligible_balance
 *   reward_amount     = reward_percentage × campaign_reward_pool
 *
 * All token quantities are handled as `bigint` base units (e.g. lamport-style
 * smallest units of an SPL token) so results are exact. Shares are floored,
 * which guarantees the sum of individual rewards can never exceed the pool.
 * Leftover "dust" from flooring and rewards below the minimum payout are
 * reported explicitly so they can be carried into a future distribution or
 * returned to the reserve — never silently lost.
 *
 * Eligibility is snapshot-based: balances are taken from a single point-in-time
 * snapshot (slot/timestamp), minus excluded wallets (treasury, liquidity
 * pools, team vaults), and filtered by a minimum eligible balance.
 *
 * NOTE: This module performs CALCULATIONS ONLY. It never sends transactions.
 */

/** Precision used for percentage display: 1e10 → percentage with 8 decimals. */
const PERCENT_SCALE = 10_000_000_000n; // 100% == PERCENT_SCALE

export class RewardCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RewardCalculationError";
  }
}

function assertNonNegative(value: bigint, label: string): void {
  if (typeof value !== "bigint") throw new RewardCalculationError(`${label} must be a bigint`);
  if (value < 0n) throw new RewardCalculationError(`${label} cannot be negative`);
}

export interface HolderRewardInput {
  /** Holder's eligible RUNNER balance (base units). */
  holderBalance: bigint;
  /** Total eligible RUNNER supply in the snapshot (base units). */
  eligibleSupply: bigint;
  /** Reward pool size, in base units of the reward token. */
  rewardPool: bigint;
}

export interface HolderRewardResult {
  /** Share of eligible supply, scaled so that 100% === PERCENT_SCALE. */
  shareScaled: bigint;
  /** Share as a percentage number (display only — do not use for payouts). */
  percentage: number;
  /** Reward in reward-token base units, floored. */
  rewardAmount: bigint;
}

/** Validates inputs and computes one holder's proportional reward. */
export function calculateHolderReward({ holderBalance, eligibleSupply, rewardPool }: HolderRewardInput): HolderRewardResult {
  assertNonNegative(holderBalance, "holderBalance");
  assertNonNegative(eligibleSupply, "eligibleSupply");
  assertNonNegative(rewardPool, "rewardPool");
  if (eligibleSupply === 0n) throw new RewardCalculationError("eligibleSupply must be greater than zero");
  if (holderBalance > eligibleSupply) {
    throw new RewardCalculationError("holderBalance cannot exceed eligibleSupply");
  }

  const shareScaled = (holderBalance * PERCENT_SCALE) / eligibleSupply;
  const rewardAmount = (holderBalance * rewardPool) / eligibleSupply; // exact floor
  return { shareScaled, percentage: scaledToPercent(shareScaled), rewardAmount };
}

export function scaledToPercent(shareScaled: bigint): number {
  // percent = shareScaled / PERCENT_SCALE * 100
  return Number((shareScaled * 100_000_000n) / PERCENT_SCALE) / 1_000_000;
}

/* -------------------------------------------------------------------------- */
/*                          Snapshot-based distribution                        */
/* -------------------------------------------------------------------------- */

export interface SnapshotHolder {
  wallet: string;
  balance: bigint;
}

export interface EligibilitySnapshot {
  /** Identifier for the snapshot, e.g. a Solana slot number. */
  snapshotId: string;
  takenAt: string; // ISO timestamp
  holders: SnapshotHolder[];
}

export interface DistributionRules {
  /** Holders below this balance are ineligible. Default 0 (all holders). */
  minEligibleBalance?: bigint;
  /** Wallets excluded from rewards (treasury, LP, team, burn). */
  excludedWallets?: string[];
  /** Rewards below this amount are not paid out and are rolled into dust. */
  minRewardAmount?: bigint;
}

export type AllocationStatus = "eligible" | "below_minimum_reward";

export interface HolderAllocation {
  wallet: string;
  balance: bigint;
  shareScaled: bigint;
  percentage: number;
  rewardAmount: bigint;
  status: AllocationStatus;
}

export interface DistributionPlan {
  snapshotId: string;
  rewardPool: bigint;
  eligibleSupply: bigint;
  eligibleHolderCount: number;
  allocations: HolderAllocation[];
  /** Sum of rewards actually allocated for payout. */
  totalAllocated: bigint;
  /** Pool remainder from flooring + rewards below minimum. Always >= 0. */
  undistributed: bigint;
}

/**
 * Builds a complete, deterministic distribution plan from a snapshot.
 * Invariant: totalAllocated + undistributed === rewardPool.
 */
export function buildDistributionPlan(
  snapshot: EligibilitySnapshot,
  rewardPool: bigint,
  rules: DistributionRules = {},
): DistributionPlan {
  assertNonNegative(rewardPool, "rewardPool");
  const minBalance = rules.minEligibleBalance ?? 0n;
  const minReward = rules.minRewardAmount ?? 1n;
  assertNonNegative(minBalance, "minEligibleBalance");
  assertNonNegative(minReward, "minRewardAmount");
  const excluded = new Set((rules.excludedWallets ?? []).map((w) => w.trim()));

  // Merge duplicate wallet rows defensively and validate balances.
  const merged = new Map<string, bigint>();
  for (const h of snapshot.holders) {
    assertNonNegative(h.balance, `balance for ${h.wallet}`);
    const key = h.wallet.trim();
    if (!key) throw new RewardCalculationError("snapshot contains an empty wallet address");
    merged.set(key, (merged.get(key) ?? 0n) + h.balance);
  }

  const eligible = [...merged.entries()]
    .filter(([wallet, balance]) => !excluded.has(wallet) && balance > 0n && balance >= minBalance)
    .sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1] > b[1] ? -1 : 1));

  const eligibleSupply = eligible.reduce((sum, [, b]) => sum + b, 0n);

  if (eligibleSupply === 0n) {
    return {
      snapshotId: snapshot.snapshotId,
      rewardPool,
      eligibleSupply: 0n,
      eligibleHolderCount: 0,
      allocations: [],
      totalAllocated: 0n,
      undistributed: rewardPool,
    };
  }

  let totalAllocated = 0n;
  const allocations: HolderAllocation[] = eligible.map(([wallet, balance]) => {
    const r = calculateHolderReward({ holderBalance: balance, eligibleSupply, rewardPool });
    const belowMin = r.rewardAmount < minReward;
    const rewardAmount = belowMin ? 0n : r.rewardAmount;
    totalAllocated += rewardAmount;
    return {
      wallet,
      balance,
      shareScaled: r.shareScaled,
      percentage: r.percentage,
      rewardAmount,
      status: belowMin ? "below_minimum_reward" : "eligible",
    };
  });

  const undistributed = rewardPool - totalAllocated;
  if (undistributed < 0n) {
    // Mathematically impossible with floor division; guard anyway.
    throw new RewardCalculationError("allocations exceed reward pool");
  }

  return {
    snapshotId: snapshot.snapshotId,
    rewardPool,
    eligibleSupply,
    eligibleHolderCount: eligible.length,
    allocations,
    totalAllocated,
    undistributed,
  };
}

/* -------------------------------------------------------------------------- */
/*                         UI helpers (display estimates)                      */
/* -------------------------------------------------------------------------- */

/** Convert a decimal token amount string/number to base units. */
export function toBaseUnits(amount: number | string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new RewardCalculationError("decimals must be an integer between 0 and 18");
  }
  const str = typeof amount === "number" ? amount.toFixed(decimals) : amount.trim();
  if (!/^\d+(\.\d+)?$/.test(str)) throw new RewardCalculationError(`invalid token amount: ${amount}`);
  const [whole = "0", frac = ""] = str.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

/** Convert base units back to a decimal string (no float rounding). */
export function fromBaseUnits(amount: bigint, decimals: number, maxFractionDigits = decimals): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, "0").slice(0, maxFractionDigits);
  frac = frac.replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${frac ? `.${frac}` : ""}`;
}

/**
 * USD-denominated estimate for UI display, e.g. "your estimated share of a
 * $700 pool". Uses cents as the pool unit so flooring happens at 1¢.
 */
export function estimateUsdReward(holderBalance: bigint, eligibleSupply: bigint, rewardPoolUsdCents: number) {
  if (!Number.isSafeInteger(rewardPoolUsdCents) || rewardPoolUsdCents < 0) {
    throw new RewardCalculationError("rewardPoolUsdCents must be a non-negative integer");
  }
  const r = calculateHolderReward({ holderBalance, eligibleSupply, rewardPool: BigInt(rewardPoolUsdCents) });
  const cents = Number(r.rewardAmount);
  return {
    percentage: r.percentage,
    rewardUsdCents: cents,
    /** True when the share rounds to less than one cent. */
    isBelowOneCent: cents === 0 && holderBalance > 0n && rewardPoolUsdCents > 0,
  };
}
