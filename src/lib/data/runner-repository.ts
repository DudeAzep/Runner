import "server-only";
import { calculateCampaignAllocation, CAMPAIGN_PACKAGES, sumAllocations } from "@/lib/economics/allocation";
import { buildDistributionPlan, fromBaseUnits } from "@/lib/economics/rewards";
import type {
  AdminOverview,
  Application,
  ApplicationStatus,
  Campaign,
  CampaignFilter,
  CampaignSort,
  Distribution,
  PlatformStats,
  Screening,
  Snapshot,
  TokenReport,
  TreasuryPurchase,
} from "@/lib/types";
import type { CampaignUpdateInput, ScreeningInput } from "@/lib/validation/schemas";
import {
  RepositoryError,
  type ApplicationDetail,
  type CampaignDetail,
  type DistributionSummary,
  type NewApplication,
  type PublicApplicationStatus,
  type WalletDistribution,
} from "./repository";
import { DEFAULT_REWARD_DECIMALS, filterAndSortCampaigns, generateReference, slugify, sumRewardsRaw, totalPurchasedTokens } from "./shared";
import { atomic, remove, save, store } from "./store";

const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${globalThis.crypto.randomUUID()}`;
const clone = <T>(v: T): T => structuredClone(v);

/**
 * All RUNNER business rules live here. Server-only; mutating methods are
 * called from server actions AFTER authorization.
 */
export class RunnerRepository {
  /* ------------------------------ Public reads ------------------------------ */

  listCampaigns(opts?: { filter?: CampaignFilter; sort?: CampaignSort; search?: string }): Campaign[] {
    return clone(filterAndSortCampaigns(store().campaigns, opts));
  }

  private summary(campaignId: string): DistributionSummary {
    const dists = store().distributions.filter((d) => d.campaignId === campaignId && d.distributionStatus !== "skipped");
    const confirmed = dists.filter((d) => d.distributionStatus === "confirmed");
    const simulated = dists.filter((d) => d.distributionStatus === "simulated");
    const planned = dists.filter((d) => d.distributionStatus === "planned" || d.distributionStatus === "submitted");
    const decimals = dists[0]?.rewardDecimals ?? 0;
    const done = [...confirmed, ...simulated];
    let status: DistributionSummary["status"] = "not_started";
    if (dists.length) {
      if (planned.length === dists.length) status = "planned";
      else if (planned.length > 0) status = "in_progress";
      else if (confirmed.length === dists.length) status = "verified";
      else status = "simulated";
    }
    return {
      recipientCount: dists.length,
      plannedCount: planned.length,
      confirmedCount: confirmed.length,
      simulatedCount: simulated.length,
      totalRewardTokens: fromBaseUnits(sumRewardsRaw(done), decimals, 4),
      status,
    };
  }

  private detail(c: Campaign): CampaignDetail {
    const s = store();
    return clone({
      campaign: c,
      screening: c.applicationId ? (s.screenings.find((x) => x.applicationId === c.applicationId) ?? null) : null,
      purchases: s.purchases.filter((p) => p.campaignId === c.id).sort((a, b) => Date.parse(b.executedAt) - Date.parse(a.executedAt)),
      snapshot: c.snapshotId ? (s.snapshots.find((x) => x.id === c.snapshotId) ?? null) : null,
      distributionSummary: this.summary(c.id),
    });
  }

  getCampaignDetail(slug: string): CampaignDetail | null {
    const c = store().campaigns.find((x) => x.slug === slug && x.status !== "cancelled");
    return c ? this.detail(c) : null;
  }

  getPlatformStats(): PlatformStats {
    const s = store();
    const live = s.campaigns.filter((c) => c.status !== "cancelled");
    const distributedCampaigns = new Set(
      s.distributions.filter((d) => d.distributionStatus === "confirmed" || d.distributionStatus === "simulated").map((d) => d.campaignId),
    );
    return {
      totalCampaigns: live.length,
      projectsReviewed: s.applications.filter((a) => a.status === "approved" || a.status === "rejected").length,
      tokensDistributed: distributedCampaigns.size,
      activeCampaigns: live.filter((c) => c.status === "active").length,
      source: live.length > 0 && live.every((c) => c.source === "verified") ? "verified" : live.some((c) => c.source === "demo") ? "demo" : "manual",
    };
  }

  getApplicationStatus(reference: string): PublicApplicationStatus | null {
    const s = store();
    const a = s.applications.find((x) => x.reference === reference.toUpperCase());
    if (!a) return null;
    const campaign = s.campaigns.find((c) => c.applicationId === a.id);
    return {
      reference: a.reference,
      projectName: a.projectName,
      ticker: a.ticker,
      campaignPackage: a.campaignPackage,
      status: a.status,
      paymentStatus: a.paymentStatus,
      paymentSignature: a.paymentSignature,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      campaignSlug: campaign && campaign.status !== "cancelled" ? campaign.slug : null,
    };
  }

  getWalletDistributions(wallet: string): WalletDistribution[] {
    const s = store();
    return clone(
      s.distributions
        .filter((d) => d.walletAddress === wallet && d.distributionStatus !== "skipped")
        .flatMap((d) => {
          const c = s.campaigns.find((x) => x.id === d.campaignId);
          return c ? [{ ...d, campaign: { slug: c.slug, projectName: c.projectName, ticker: c.ticker, status: c.status } }] : [];
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    );
  }

  /* ------------------------------ Applications ------------------------------ */

  getApplicationByReference(reference: string): Application | null {
    const a = store().applications.find((x) => x.reference === reference.toUpperCase());
    return a ? clone(a) : null;
  }

  createApplication(input: NewApplication, opts: { livePayments: boolean }): Application {
    const s = store();
    const dup = s.applications.find(
      (a) => a.contractAddress === input.contractAddress && (a.status === "submitted" || a.status === "under_review") && a.source !== "demo",
    );
    if (dup) throw new RepositoryError("An application for this contract address is already pending review.", "conflict");
    let reference = generateReference();
    while (s.applications.some((a) => a.reference === reference)) reference = generateReference();
    const t = now();
    const app: Application = {
      ...input,
      id: newId("app"),
      reference,
      status: "submitted",
      paymentStatus: opts.livePayments ? "awaiting_payment" : "test_mode_simulated",
      paymentSignature: null,
      paymentPayer: null,
      paidAt: null,
      createdAt: t,
      updatedAt: t,
      source: "manual",
    };
    save("applications", app);
    return clone(app);
  }

  isSignatureUsed(signature: string): boolean {
    return store().usedSignatures.some((u) => u.id === signature);
  }

  markApplicationPaid(reference: string, payment: { signature: string; payer: string | null }): Application {
    const app = store().applications.find((a) => a.reference === reference);
    if (!app) throw new RepositoryError("Application not found", "not_found");
    if (app.paymentStatus === "paid") return clone(app);
    if (this.isSignatureUsed(payment.signature)) throw new RepositoryError("This transaction was already used for another payment.", "conflict");
    const updated: Application = { ...app, paymentStatus: "paid", paymentSignature: payment.signature, paymentPayer: payment.payer, paidAt: now(), updatedAt: now() };
    atomic(() => {
      save("applications", updated);
      save("usedSignatures", { id: payment.signature, usedFor: `payment:${reference}`, at: now() });
    });
    return clone(updated);
  }

  getAdminOverview(): AdminOverview {
    const s = store();
    const counted = s.campaigns.filter((c) => c.status !== "cancelled");
    const totals = sumAllocations(
      counted.map((c) => ({
        totalUsdCents: c.totalCampaignFeeCents,
        rewardUsdCents: c.rewardAllocationCents,
        operationsUsdCents: c.operationsAllocationCents,
        reserveUsdCents: c.reserveAllocationCents,
      })),
    );
    return {
      totalApplications: s.applications.length,
      pendingApplications: s.applications.filter((a) => a.status === "submitted" || a.status === "under_review").length,
      approvedCampaigns: counted.length,
      rejectedApplications: s.applications.filter((a) => a.status === "rejected").length,
      simulatedRevenueCents: totals.totalUsdCents,
      simulatedRewardAllocationCents: totals.rewardUsdCents,
      simulatedOperationsCents: totals.operationsUsdCents,
      simulatedReserveCents: totals.reserveUsdCents,
    };
  }

  /** Revenue actually received on-chain (verified USDC payments). */
  getVerifiedRevenueCents(): number {
    return store()
      .applications.filter((a) => a.paymentStatus === "paid")
      .reduce((sum, a) => sum + CAMPAIGN_PACKAGES[a.campaignPackage].feeUsdCents, 0);
  }

  listApplications(opts: { search?: string; status?: ApplicationStatus | "all" } = {}): Application[] {
    let list = [...store().applications];
    if (opts.status && opts.status !== "all") list = list.filter((a) => a.status === opts.status);
    const q = opts.search?.trim().toLowerCase();
    if (q) {
      list = list.filter((a) =>
        [a.projectName, a.ticker, a.reference, a.contractAddress, a.applicantWallet].some((f) => f.toLowerCase().includes(q)),
      );
    }
    return clone(list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  }

  getApplicationDetail(appId: string): ApplicationDetail | null {
    const s = store();
    const application = s.applications.find((a) => a.id === appId);
    if (!application) return null;
    const reports = s.tokenReports.filter((r) => r.applicationId === appId).sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt));
    return clone({
      application,
      screening: s.screenings.find((x) => x.applicationId === appId) ?? null,
      campaign: s.campaigns.find((c) => c.applicationId === appId) ?? null,
      tokenReport: reports[0] ?? null,
    });
  }

  saveTokenReport(report: TokenReport): void {
    // Keep only the latest report per application.
    for (const old of store().tokenReports.filter((r) => r.applicationId === report.applicationId)) remove("tokenReports", old.id);
    save("tokenReports", report);
  }

  saveScreening(applicationId: string, input: ScreeningInput, reviewer: string): Screening {
    const s = store();
    const app = s.applications.find((a) => a.id === applicationId);
    if (!app) throw new RepositoryError("Application not found", "not_found");
    const existing = s.screenings.find((x) => x.applicationId === applicationId);
    const screening: Screening = {
      ...(input as Omit<Screening, "id" | "applicationId" | "reviewedBy" | "createdAt">),
      id: existing?.id ?? newId("scr"),
      applicationId,
      reviewedBy: reviewer,
      createdAt: now(),
    };
    atomic(() => {
      save("screenings", screening);
      if (app.status === "submitted") save("applications", { ...app, status: "under_review", updatedAt: now() });
    });
    return clone(screening);
  }

  setApplicationStatus(applicationId: string, status: ApplicationStatus): Application {
    const s = store();
    const app = s.applications.find((a) => a.id === applicationId);
    if (!app) throw new RepositoryError("Application not found", "not_found");
    if (status === "approved") {
      if (!s.screenings.some((x) => x.applicationId === applicationId)) throw new RepositoryError("Save a screening report before approving.", "invalid_state");
      if (app.paymentStatus === "awaiting_payment") throw new RepositoryError("This application has not paid its campaign fee yet.", "invalid_state");
    }
    if (status === "rejected" && s.campaigns.some((c) => c.applicationId === applicationId && c.status !== "cancelled")) {
      throw new RepositoryError("Cancel the linked campaign before rejecting this application.", "invalid_state");
    }
    const updated = { ...app, status, updatedAt: now() };
    save("applications", updated);
    return clone(updated);
  }

  /* -------------------------------- Campaigns -------------------------------- */

  createCampaignFromApplication(applicationId: string, opts: { status: Campaign["status"]; featured: boolean; snapshotAt: string | null }): Campaign {
    const s = store();
    const app = s.applications.find((a) => a.id === applicationId);
    if (!app) throw new RepositoryError("Application not found", "not_found");
    if (app.status !== "approved") throw new RepositoryError("Only approved applications can become campaigns.", "invalid_state");
    if (s.campaigns.some((c) => c.applicationId === applicationId)) throw new RepositoryError("A campaign already exists for this application.", "conflict");
    const screening = s.screenings.find((x) => x.applicationId === applicationId);
    const report = s.tokenReports.find((r) => r.applicationId === applicationId);
    const alloc = calculateCampaignAllocation(CAMPAIGN_PACKAGES[app.campaignPackage].feeUsdCents);
    let slug = slugify(app.projectName);
    if (s.campaigns.some((c) => c.slug === slug)) slug = `${slug}-${app.reference.slice(4).toLowerCase()}`;
    const t = now();
    const campaign: Campaign = {
      id: newId("cmp"),
      slug,
      applicationId,
      projectName: app.projectName,
      ticker: app.ticker,
      tokenAddress: app.contractAddress,
      description: app.description,
      website: app.website,
      twitter: app.twitter,
      telegram: app.telegram,
      discord: app.discord,
      campaignPackage: app.campaignPackage,
      totalCampaignFeeCents: alloc.totalUsdCents,
      rewardAllocationCents: alloc.rewardUsdCents,
      operationsAllocationCents: alloc.operationsUsdCents,
      reserveAllocationCents: alloc.reserveUsdCents,
      status: opts.status,
      featured: opts.featured,
      riskLevel: screening?.riskLevel ?? "elevated",
      screeningDate: screening?.createdAt ?? t,
      marketCapAtScreeningUsd: screening?.marketCapUsd ?? null,
      liquidityAtScreeningUsd: screening?.liquidityUsd ?? null,
      holderCountAtScreening: screening?.holderCount ?? null,
      snapshotAt: opts.snapshotAt,
      snapshotId: null,
      eligibleSupply: null,
      runnerDecimals: 0,
      rewardDecimals: report?.decimals ?? null,
      createdAt: t,
      updatedAt: t,
      // Market figures count as verified only when an on-chain/market report backed the screening.
      source: report && !report.errors.length ? "verified" : "manual",
    };
    save("campaigns", campaign);
    return clone(campaign);
  }

  listAllCampaigns(): Campaign[] {
    return clone([...store().campaigns].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  }

  getCampaignById(campaignId: string): CampaignDetail | null {
    const c = store().campaigns.find((x) => x.id === campaignId);
    return c ? this.detail(c) : null;
  }

  private campaign(campaignId: string): Campaign {
    const c = store().campaigns.find((x) => x.id === campaignId);
    if (!c) throw new RepositoryError("Campaign not found", "not_found");
    return c;
  }

  updateCampaign(campaignId: string, input: CampaignUpdateInput): Campaign {
    const c = this.campaign(campaignId);
    const updated = { ...c, ...input, updatedAt: now() };
    save("campaigns", updated);
    return clone(updated);
  }

  recordPurchase(
    campaignId: string,
    input: { usdcSpentCents: number; tokenAmount: string; notes: string; signature: string | null; rewardDecimals: number | null },
  ): TreasuryPurchase {
    const c = this.campaign(campaignId);
    const spent = store().purchases.filter((p) => p.campaignId === campaignId).reduce((sum, p) => sum + p.usdcSpentCents, 0);
    // Real swaps can land a few cents off the quote; allow 1% tolerance for verified purchases only.
    const tolerance = input.signature ? Math.ceil(c.rewardAllocationCents * 0.01) : 0;
    if (spent + input.usdcSpentCents > c.rewardAllocationCents + tolerance) {
      throw new RepositoryError("Total purchases cannot exceed the campaign's 70% reward allocation.", "invalid_state");
    }
    if (input.signature && this.isSignatureUsed(input.signature)) throw new RepositoryError("This transaction was already recorded.", "conflict");
    if (c.rewardDecimals != null && input.rewardDecimals != null && c.rewardDecimals !== input.rewardDecimals) {
      throw new RepositoryError("Token decimals do not match earlier purchases.", "invalid_state");
    }
    const purchase: TreasuryPurchase = {
      id: newId("buy"),
      campaignId,
      usdcSpentCents: input.usdcSpentCents,
      tokenAmount: input.tokenAmount,
      status: input.signature ? "confirmed" : "simulated",
      transactionSignature: input.signature,
      notes: input.notes,
      executedAt: now(),
      source: input.signature ? "verified" : c.source === "demo" ? "demo" : "manual",
    };
    atomic(() => {
      save("purchases", purchase);
      if (c.rewardDecimals == null) save("campaigns", { ...c, rewardDecimals: input.rewardDecimals ?? DEFAULT_REWARD_DECIMALS, updatedAt: now() });
      if (input.signature) save("usedSignatures", { id: input.signature, usedFor: `purchase:${campaignId}`, at: now() });
    });
    return clone(purchase);
  }

  /* -------------------------------- Snapshots -------------------------------- */

  saveSnapshot(
    campaignId: string,
    input: { method: Snapshot["method"]; runnerMint: string | null; slot: number | null; runnerDecimals: number; holders: { wallet: string; balance: string }[]; excludedWallets: string[] },
  ): Snapshot {
    const c = this.campaign(campaignId);
    if (store().distributions.some((d) => d.campaignId === campaignId && d.distributionStatus !== "planned")) {
      throw new RepositoryError("Distributions have already been sent for this campaign; the snapshot is locked.", "invalid_state");
    }
    const excluded = new Set(input.excludedWallets);
    const holders = input.holders.filter((h) => !excluded.has(h.wallet) && BigInt(h.balance) > 0n);
    const eligibleSupply = holders.reduce((s, h) => s + BigInt(h.balance), 0n);
    if (eligibleSupply === 0n) throw new RepositoryError("Snapshot has no eligible holders.", "invalid_state");
    const snapshot: Snapshot = {
      id: newId("snap"),
      campaignId,
      takenAt: now(),
      method: input.method,
      runnerMint: input.runnerMint,
      slot: input.slot,
      runnerDecimals: input.runnerDecimals,
      eligibleSupply: eligibleSupply.toString(),
      holderCount: holders.length,
      excludedWallets: [...excluded],
      source: input.method === "rpc" ? "verified" : "manual",
    };
    atomic(() => {
      // A new snapshot replaces any unsent plan.
      for (const d of store().distributions.filter((x) => x.campaignId === campaignId)) remove("distributions", d.id);
      save("snapshots", snapshot);
      save("snapshotHolders", { id: snapshot.id, holders });
      save("campaigns", { ...c, snapshotId: snapshot.id, eligibleSupply: snapshot.eligibleSupply, runnerDecimals: input.runnerDecimals, snapshotAt: snapshot.takenAt, updatedAt: now() });
    });
    return clone(snapshot);
  }

  /* ------------------------------ Distributions ------------------------------ */

  /** Builds per-wallet reward rows from the campaign's snapshot and purchased tokens. */
  planDistribution(campaignId: string, opts: { liveOnly: boolean; minRewardRaw?: bigint }): { planned: number; skipped: number; undistributed: string } {
    const s = store();
    const c = this.campaign(campaignId);
    if (!c.snapshotId) throw new RepositoryError("Take a holder snapshot first.", "invalid_state");
    const holders = s.snapshotHolders.find((h) => h.id === c.snapshotId)?.holders ?? [];
    const existing = s.distributions.filter((d) => d.campaignId === campaignId);
    if (existing.some((d) => d.distributionStatus !== "planned" && d.distributionStatus !== "skipped")) {
      throw new RepositoryError("Distributions have already started; the plan can't be rebuilt.", "invalid_state");
    }
    const purchases = s.purchases.filter((p) => p.campaignId === campaignId && (!opts.liveOnly || p.status === "confirmed"));
    if (!purchases.length) throw new RepositoryError(opts.liveOnly ? "Record a confirmed treasury purchase first." : "Record a treasury purchase first.", "invalid_state");
    const decimals = c.rewardDecimals ?? DEFAULT_REWARD_DECIMALS;
    const pool = totalPurchasedTokens(purchases, decimals);
    const plan = buildDistributionPlan(
      { snapshotId: c.snapshotId, takenAt: c.snapshotAt ?? now(), holders: holders.map((h) => ({ wallet: h.wallet, balance: BigInt(h.balance) })) },
      pool,
      { minRewardAmount: opts.minRewardRaw ?? 1n },
    );
    const t = now();
    atomic(() => {
      for (const d of existing) remove("distributions", d.id);
      for (const a of plan.allocations) {
        save("distributions", {
          id: newId("dist"),
          campaignId,
          snapshotId: c.snapshotId,
          walletAddress: a.wallet,
          runnerBalance: a.balance.toString(),
          eligibleSupply: plan.eligibleSupply.toString(),
          runnerDecimals: c.runnerDecimals,
          rewardPercentage: a.percentage,
          rewardAmount: fromBaseUnits(a.rewardAmount, decimals),
          rewardAmountRaw: a.rewardAmount.toString(),
          rewardDecimals: decimals,
          distributionStatus: a.status === "eligible" ? "planned" : "skipped",
          transactionSignature: null,
          createdAt: t,
          updatedAt: t,
          source: c.source === "demo" ? "demo" : "manual",
        } satisfies Distribution);
      }
    });
    return {
      planned: plan.allocations.filter((a) => a.status === "eligible").length,
      skipped: plan.allocations.filter((a) => a.status !== "eligible").length,
      undistributed: fromBaseUnits(plan.undistributed, decimals),
    };
  }

  listDistributions(campaignId: string): Distribution[] {
    return clone(
      store()
        .distributions.filter((d) => d.campaignId === campaignId)
        .sort((a, b) => (BigInt(b.rewardAmountRaw) > BigInt(a.rewardAmountRaw) ? 1 : BigInt(b.rewardAmountRaw) < BigInt(a.rewardAmountRaw) ? -1 : 0)),
    );
  }

  /** Next planned rows to send, largest first. */
  nextBatch(campaignId: string, size: number): Distribution[] {
    return this.listDistributions(campaignId)
      .filter((d) => d.distributionStatus === "planned")
      .slice(0, size);
  }

  /** Marks rows as included in a broadcast transaction BEFORE sending, so a crash can never cause a double payment. */
  markSubmitted(ids: string[], signature: string): void {
    atomic(() => {
      for (const id of ids) {
        const d = store().distributions.find((x) => x.id === id);
        if (!d || d.distributionStatus !== "planned") throw new RepositoryError("A recipient in this batch is no longer pending. Refresh and try again.", "conflict");
        save("distributions", { ...d, distributionStatus: "submitted", transactionSignature: signature, updatedAt: now() });
      }
      save("usedSignatures", { id: signature, usedFor: "distribution", at: now() });
    });
  }

  /** Applies the on-chain verification result for a submitted batch. */
  settleSubmitted(signature: string, confirmedWallets: string[], landed: boolean): { confirmed: number; reverted: number } {
    let confirmed = 0;
    let reverted = 0;
    atomic(() => {
      for (const d of store().distributions.filter((x) => x.transactionSignature === signature && x.distributionStatus === "submitted")) {
        if (confirmedWallets.includes(d.walletAddress)) {
          save("distributions", { ...d, distributionStatus: "confirmed", source: "verified", updatedAt: now() });
          confirmed++;
        } else if (!landed) {
          save("distributions", { ...d, distributionStatus: "planned", transactionSignature: null, updatedAt: now() });
          reverted++;
        }
      }
    });
    return { confirmed, reverted };
  }

  submittedSignatures(campaignId: string): string[] {
    return [...new Set(store().distributions.filter((d) => d.campaignId === campaignId && d.distributionStatus === "submitted").map((d) => d.transactionSignature!))];
  }

  /** TEST MODE: mark every planned row as simulated (no transactions). */
  simulateAll(campaignId: string): number {
    let n = 0;
    atomic(() => {
      for (const d of store().distributions.filter((x) => x.campaignId === campaignId && x.distributionStatus === "planned")) {
        save("distributions", { ...d, distributionStatus: "simulated", updatedAt: now() });
        n++;
      }
    });
    return n;
  }

  /* ---------------------------------- Admin ---------------------------------- */

  demoRecordCount(): number {
    const s = store();
    return [s.applications, s.campaigns, s.purchases, s.distributions, s.snapshots].reduce((n, list) => n + list.filter((x) => x.source === "demo").length, 0);
  }

  /** Deletes all fictional sample data so the platform shows only real records. */
  removeDemoData(): number {
    const s = store();
    let n = 0;
    atomic(() => {
      const demoApps = new Set(s.applications.filter((a) => a.source === "demo").map((a) => a.id));
      const demoCampaigns = new Set(s.campaigns.filter((c) => c.source === "demo" || (c.applicationId && demoApps.has(c.applicationId))).map((c) => c.id));
      const demoSnaps = new Set(s.snapshots.filter((x) => demoCampaigns.has(x.campaignId) || x.source === "demo").map((x) => x.id));
      const del = (name: Parameters<typeof remove>[0], ids: string[]) => ids.forEach((id) => (remove(name, id), n++));
      del("distributions", s.distributions.filter((d) => demoCampaigns.has(d.campaignId)).map((d) => d.id));
      del("purchases", s.purchases.filter((p) => demoCampaigns.has(p.campaignId)).map((p) => p.id));
      del("snapshotHolders", s.snapshotHolders.filter((h) => demoSnaps.has(h.id)).map((h) => h.id));
      del("snapshots", [...demoSnaps]);
      del("campaigns", [...demoCampaigns]);
      del("screenings", s.screenings.filter((x) => demoApps.has(x.applicationId)).map((x) => x.id));
      del("tokenReports", s.tokenReports.filter((x) => demoApps.has(x.applicationId)).map((x) => x.id));
      del("applications", [...demoApps]);
    });
    return n;
  }
}
