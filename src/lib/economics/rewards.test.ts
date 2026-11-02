import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDistributionPlan,
  calculateHolderReward,
  estimateUsdReward,
  fromBaseUnits,
  RewardCalculationError,
  toBaseUnits,
} from "./rewards";

describe("calculateHolderReward", () => {
  it("handles the spec example: 250k of 100M → 0.25% of a $700 pool", () => {
    const r = calculateHolderReward({ holderBalance: 250_000n, eligibleSupply: 100_000_000n, rewardPool: 70_000n /* cents */ });
    assert.equal(r.percentage, 0.25);
    assert.equal(r.rewardAmount, 175n); // $1.75
  });

  it("floors fractional base units (never overpays)", () => {
    const r = calculateHolderReward({ holderBalance: 1n, eligibleSupply: 3n, rewardPool: 10n });
    assert.equal(r.rewardAmount, 3n);
  });

  it("validates balances and supply", () => {
    assert.throws(() => calculateHolderReward({ holderBalance: 1n, eligibleSupply: 0n, rewardPool: 1n }), RewardCalculationError);
    assert.throws(() => calculateHolderReward({ holderBalance: 5n, eligibleSupply: 4n, rewardPool: 1n }), RewardCalculationError);
    assert.throws(() => calculateHolderReward({ holderBalance: -1n, eligibleSupply: 4n, rewardPool: 1n }), RewardCalculationError);
    assert.throws(() => calculateHolderReward({ holderBalance: 1n, eligibleSupply: 4n, rewardPool: -1n }), RewardCalculationError);
  });

  it("gives the whole pool to a 100% holder", () => {
    const r = calculateHolderReward({ holderBalance: 42n, eligibleSupply: 42n, rewardPool: 999n });
    assert.equal(r.rewardAmount, 999n);
    assert.equal(r.percentage, 100);
  });
});

describe("buildDistributionPlan", () => {
  const snapshot = {
    snapshotId: "slot-123",
    takenAt: "2026-11-01T00:00:00Z",
    holders: [
      { wallet: "A", balance: 500n },
      { wallet: "B", balance: 300n },
      { wallet: "C", balance: 199n },
      { wallet: "D", balance: 1n },
      { wallet: "TREASURY", balance: 10_000n },
      { wallet: "B", balance: 0n }, // duplicate row merges
    ],
  };

  it("keeps the invariant allocated + undistributed === pool", () => {
    for (const pool of [0n, 1n, 7n, 1_000n, 1_000_003n]) {
      const plan = buildDistributionPlan(snapshot, pool, { excludedWallets: ["TREASURY"] });
      assert.equal(plan.totalAllocated + plan.undistributed, pool);
      assert.ok(plan.undistributed >= 0n);
    }
  });

  it("excludes wallets, applies minimum balance, and orders by balance", () => {
    const plan = buildDistributionPlan(snapshot, 1_000n, { excludedWallets: ["TREASURY"], minEligibleBalance: 2n });
    assert.equal(plan.eligibleSupply, 999n);
    assert.deepEqual(
      plan.allocations.map((a) => a.wallet),
      ["A", "B", "C"],
    );
    assert.equal(plan.allocations[0]!.rewardAmount, 500n);
  });

  it("rolls rewards below the minimum into undistributed dust", () => {
    const plan = buildDistributionPlan(snapshot, 1_000n, { excludedWallets: ["TREASURY"], minRewardAmount: 5n });
    const d = plan.allocations.find((a) => a.wallet === "D")!;
    assert.equal(d.status, "below_minimum_reward");
    assert.equal(d.rewardAmount, 0n);
    assert.equal(plan.totalAllocated + plan.undistributed, 1_000n);
  });

  it("returns the whole pool as undistributed when nobody is eligible", () => {
    const plan = buildDistributionPlan({ ...snapshot, holders: [] }, 500n);
    assert.equal(plan.eligibleHolderCount, 0);
    assert.equal(plan.undistributed, 500n);
  });

  it("rejects negative balances and empty wallets", () => {
    assert.throws(() => buildDistributionPlan({ ...snapshot, holders: [{ wallet: "X", balance: -1n }] }, 1n), RewardCalculationError);
    assert.throws(() => buildDistributionPlan({ ...snapshot, holders: [{ wallet: " ", balance: 1n }] }, 1n), RewardCalculationError);
  });
});

describe("unit conversion + estimates", () => {
  it("round-trips decimal token amounts", () => {
    assert.equal(toBaseUnits("1842105.263157", 6), 1_842_105_263_157n);
    assert.equal(fromBaseUnits(1_842_105_263_157n, 6), "1842105.263157");
    assert.equal(fromBaseUnits(1_500_000n, 6), "1.5");
    assert.equal(toBaseUnits("0.1", 9), 100_000_000n);
    assert.throws(() => toBaseUnits("abc", 6), RewardCalculationError);
  });

  it("flags rewards that round below one cent", () => {
    const e = estimateUsdReward(1n, 100_000_000n, 70_000);
    assert.equal(e.rewardUsdCents, 0);
    assert.equal(e.isBelowOneCent, true);
    const ok = estimateUsdReward(250_000n, 100_000_000n, 70_000);
    assert.equal(ok.rewardUsdCents, 175);
    assert.equal(ok.isBelowOneCent, false);
  });
});
