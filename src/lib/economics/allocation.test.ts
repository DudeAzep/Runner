import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocationForPackage,
  calculateCampaignAllocation,
  CAMPAIGN_PACKAGES,
  isAllocationConsistent,
  sumAllocations,
} from "./allocation";

describe("calculateCampaignAllocation", () => {
  it("splits a $1,000 campaign into $700 / $200 / $100", () => {
    assert.deepEqual(calculateCampaignAllocation(100_000), {
      totalUsdCents: 100_000,
      rewardUsdCents: 70_000,
      operationsUsdCents: 20_000,
      reserveUsdCents: 10_000,
    });
  });

  it("matches every package", () => {
    assert.equal(allocationForPackage("starter").rewardUsdCents, 10_500);
    assert.equal(allocationForPackage("growth").operationsUsdCents, 5_000);
    assert.equal(allocationForPackage("featured").reserveUsdCents, 5_000);
    assert.equal(CAMPAIGN_PACKAGES.featured.feeUsdCents, 50_000);
  });

  it("always sums exactly to the total, with remainder going to reserve", () => {
    for (const total of [0, 1, 3, 7, 99, 101, 12_345, 99_999, 1_000_001]) {
      const a = calculateCampaignAllocation(total);
      assert.equal(a.rewardUsdCents + a.operationsUsdCents + a.reserveUsdCents, total, `total ${total}`);
      assert.ok(a.reserveUsdCents >= Math.floor(total / 10));
    }
    const odd = calculateCampaignAllocation(3);
    assert.deepEqual([odd.rewardUsdCents, odd.operationsUsdCents, odd.reserveUsdCents], [2, 0, 1]);
  });

  it("rejects invalid inputs", () => {
    assert.throws(() => calculateCampaignAllocation(-1), RangeError);
    assert.throws(() => calculateCampaignAllocation(10.5), RangeError);
    assert.throws(() => calculateCampaignAllocation(Number.NaN), RangeError);
  });

  it("aggregates and checks consistency", () => {
    const sum = sumAllocations([allocationForPackage("starter"), allocationForPackage("growth")]);
    assert.equal(sum.totalUsdCents, 40_000);
    assert.equal(sum.rewardUsdCents, 28_000);
    assert.ok(isAllocationConsistent(sum));
    assert.equal(isAllocationConsistent({ ...sum, reserveUsdCents: sum.reserveUsdCents + 1 }), false);
  });
});
