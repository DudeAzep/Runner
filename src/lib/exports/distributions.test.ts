import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Distribution } from "@/lib/types";
import { distributionsCsv } from "./distributions";

const campaign = { id: "campaign-1", projectName: "Test Project", ticker: "TEST", tokenAddress: "mint-address" };
const row: Distribution = {
  id: "dist-1", campaignId: campaign.id, snapshotId: "snapshot-1", walletAddress: "wallet-address",
  runnerBalance: "9007199254740993123456", eligibleSupply: "18014398509481986246912", runnerDecimals: 6,
  rewardPercentage: 50, rewardAmount: "0.12", rewardAmountRaw: "123456789", rewardDecimals: 9,
  distributionStatus: "planned", transactionSignature: null, source: "manual",
  createdAt: "2026-11-02T00:00:00.000Z", updatedAt: "2026-11-02T00:00:00.000Z",
};

describe("distribution CSV export", () => {
  it("exports exact raw balances and full decimal amounts without float rounding", () => {
    const csv = distributionsCsv(campaign, [row]);
    assert.ok(csv.startsWith('\uFEFF"campaign_id","project_name"'));
    assert.ok(csv.includes('"9007199254740993123456","6","9007199254740993.123456"'));
    assert.ok(csv.includes('"123456789","9","0.123456789"'));
    assert.ok(csv.includes('"planned","","manual"'));
    assert.ok(csv.endsWith("\r\n"));
  });

  it("exports every recipient beyond the UI's 200-row limit", () => {
    const rows = Array.from({ length: 205 }, (_, i) => ({ ...row, id: `dist-${i}` }));
    const csv = distributionsCsv(campaign, rows);
    assert.equal(csv.trimEnd().split("\r\n").length, 206);
    assert.ok(csv.includes('"dist-204"'));
  });

  it("preserves all statuses, signatures, snapshot ids, and data sources", () => {
    const statuses = ["planned", "submitted", "confirmed", "simulated", "skipped"] as const;
    const rows = statuses.map((status) => ({ ...row, distributionStatus: status, transactionSignature: "sig-1", source: "demo" as const }));
    const csv = distributionsCsv(campaign, rows);
    for (const status of statuses) assert.ok(csv.includes(`"${status}","sig-1","demo"`));
    assert.equal(csv.split('"snapshot-1"').length - 1, 5);
  });

  it("quotes commas, embedded quotes, line breaks, and Unicode names", () => {
    const csv = distributionsCsv({ ...campaign, projectName: 'Café, "Runner"\r\nProject' }, [row]);
    assert.ok(csv.includes('"Café, ""Runner""\r\nProject"'));
  });

  it("neutralizes spreadsheet formulas including leading whitespace and control characters", () => {
    for (const projectName of ["=1+1", "+SUM(A1)", "-1+2", "@SUM(A1)", "  =1+1", "\t=1+1", "\rtext", "\ntext"]) {
      assert.ok(distributionsCsv({ ...campaign, projectName }, [row]).includes(`"'${projectName}"`));
    }
  });

  it("exports headers for an empty plan and leaves input rows unchanged", () => {
    assert.equal(distributionsCsv(campaign, []).trimEnd().split("\r\n").length, 1);
    const original = structuredClone(row);
    distributionsCsv(campaign, [row]);
    assert.deepEqual(row, original);
  });
});
