import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import type { RunnerRepository as Repo } from "./runner-repository";

// In-memory SQLite database seeded with demo data.
process.env.RUNNER_DB_PATH = ":memory:";
process.env.SEED_DEMO_DATA = "true";

const W1 = "DbF5KSt39LEiJEf2uZZTwzcNvxzVxUABHXHSuK6ZSghx";
const W2 = "HbEForh95LJQxFHb8DnfrRwa9x6wCKB96f5ApVgcVafK";
const W3 = "9nvnHm8SYgnJXbXH3SP4QtyADNprVLKmG84Gn4bxX6NQ";
const TREASURY = "FseP875vR2fVn9GNiMk4ExaCSeSmRaeqpBoFVAxQpqYp";

let repo: Repo;
before(async () => {
  const { RunnerRepository } = await import("./runner-repository");
  repo = new RunnerRepository();
});

describe("RunnerRepository lifecycle", () => {
  let appId = "";
  let ref = "";
  let campaignId = "";

  it("seeds demo data", () => {
    assert.ok(repo.listCampaigns().length >= 6);
    assert.ok(repo.demoRecordCount() > 0);
  });

  const newApp = (wallet: string, contractAddress: string, projectName = "Lifecycle Test") =>
    repo.createApplication({
      projectName,
      ticker: "LIFE",
      contractAddress,
      website: "https://x.example",
      twitter: "https://x.com/x",
      telegram: "https://t.me/x",
      discord: "https://discord.gg/x",
      description: "A long enough description for the lifecycle integration test.",
      applicantWallet: wallet,
      campaignPackage: "starter",
    });
  const screen = (id: string) =>
    repo.saveScreening(
      id,
      {
        liquidityScore: 7, holderDistributionScore: 7, developerActivityScore: 7, communityScore: 7, tradingActivityScore: 7,
        tokenAuthoritiesScore: 10, tokenomicsScore: 7, manipulationScore: 7, marketCapUsd: null, liquidityUsd: null, holderCount: null,
        top10HolderPct: null, mintAuthorityRevoked: true, freezeAuthorityRevoked: true, riskFlags: [], screeningNotes: "", recommendation: "approve", riskLevel: "moderate",
      },
      "tester",
    );

  it("submits for free, approves without payment, and blocks the campaign until paid", () => {
    const app = newApp(W1, "2zFfqTWyQ1cky7MhSuQQBGQUy5JVpn9aYMZM5uUKx7q1");
    appId = app.id;
    ref = app.reference;
    assert.equal(app.paymentStatus, "awaiting_payment");
    assert.deepEqual(repo.listApplicationsForWallet(W1).map((a) => a.reference), [ref]);
    // Paying before approval is refused.
    assert.throws(() => repo.markApplicationPaid(ref, { signature: "6".repeat(88), payer: W1 }), /after the application is approved/);
    screen(appId);
    repo.setApplicationStatus(appId, "approved");
    assert.throws(() => repo.createCampaignFromApplication(appId, { status: "active", featured: false, snapshotAt: null }), /hasn't paid/);
  });

  it("limits how many applications one wallet can have in review", () => {
    for (let i = 0; i < 3; i++) newApp(W3, `CapTest${i}1111111111111111111111111111111111`.slice(0, 44), `Cap ${i}`);
    assert.throws(() => newApp(W3, "CapTest91111111111111111111111111111111111111".slice(0, 44)), /already have 3/);
  });

  it("marks payment once after approval and rejects signature reuse", () => {
    const sig = "5".repeat(88);
    repo.markApplicationPaid(ref, { signature: sig, payer: W1 });
    assert.equal(repo.getApplicationByReference(ref)?.paymentStatus, "paid");
    assert.ok(repo.isSignatureUsed(sig));
    const other = newApp(W2, "3zFfqTWyQ1cky7MhSuQQBGQUy5JVpn9aYMZM5uUKx7q1", "Other");
    screen(other.id);
    repo.setApplicationStatus(other.id, "approved");
    assert.throws(() => repo.markApplicationPaid(other.reference, { signature: sig, payer: W2 }), /already used/);
  });

  it("creates a campaign with its package's split once paid", () => {
    const c = repo.createCampaignFromApplication(appId, { status: "active", featured: false, snapshotAt: null });
    campaignId = c.id;
    // Starter: $500 at 70/20/10.
    assert.equal(c.rewardAllocationCents, 35_000);
    assert.equal(c.operationsAllocationCents + c.reserveAllocationCents + c.rewardAllocationCents, 50_000);
  });

  it("enforces the purchase cap", () => {
    assert.throws(() => repo.recordPurchase(campaignId, { usdcSpentCents: 35_001, tokenAmount: "1", notes: "", signature: null, rewardDecimals: null }), /reward allocation/);
    repo.recordPurchase(campaignId, { usdcSpentCents: 35_000, tokenAmount: "1000", notes: "", signature: null, rewardDecimals: 6 });
  });

  it("snapshots with exclusions and plans a pro-rata distribution that never exceeds the pool", () => {
    const snap = repo.saveSnapshot(campaignId, {
      method: "csv",
      runnerMint: null,
      slot: null,
      runnerDecimals: 0,
      holders: [
        { wallet: W1, balance: "600" },
        { wallet: W2, balance: "300" },
        { wallet: W3, balance: "100" },
        { wallet: TREASURY, balance: "5000" },
      ],
      excludedWallets: [TREASURY],
    });
    assert.equal(snap.eligibleSupply, "1000");
    assert.equal(snap.holderCount, 3);
    const plan = repo.planDistribution(campaignId, { liveOnly: false });
    assert.equal(plan.planned, 3);
    const rows = repo.listDistributions(campaignId);
    const total = rows.reduce((s, d) => s + BigInt(d.rewardAmountRaw), 0n);
    assert.ok(total <= 1000n * 10n ** 6n);
    assert.equal(rows.find((r) => r.walletAddress === W1)?.rewardAmount, "600");
  });

  it("marks a batch submitted before sending and settles per recipient", () => {
    const batch = repo.nextBatch(campaignId, 2);
    assert.equal(batch.length, 2);
    const sig = "4".repeat(88);
    repo.markSubmitted(batch.map((b) => b.id), sig);
    assert.throws(() => repo.markSubmitted([batch[0]!.id], "3".repeat(88)), /no longer pending/);
    assert.throws(() => repo.planDistribution(campaignId, { liveOnly: false }), /already started/);
    const r = repo.settleSubmitted(sig, [batch[0]!.walletAddress], true);
    assert.deepEqual(r, { confirmed: 1, reverted: 0 });
    // A batch that never landed returns its rows to the queue.
    const r2 = repo.settleSubmitted(sig, [], false);
    assert.equal(r2.reverted, 1);
    assert.equal(repo.nextBatch(campaignId, 10).length, 2);
  });

  it("removes demo data but keeps real records", () => {
    repo.removeDemoData();
    assert.equal(repo.demoRecordCount(), 0);
    assert.ok(repo.getCampaignById(campaignId));
    assert.equal(repo.listCampaigns().length, 1);
  });
});
