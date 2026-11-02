import { calculateCampaignAllocation, CAMPAIGN_PACKAGES, sumAllocations } from "@/lib/economics/allocation";
import { fromBaseUnits } from "@/lib/economics/rewards";
import type { Application, ApplicationStatus, Campaign, Distribution, Screening, TreasuryPurchase } from "@/lib/types";
import type { CampaignUpdateInput, ScreeningInput } from "@/lib/validation/schemas";
import { createDemoSeed, type DemoSeed } from "./demo-seed";
import {
  RepositoryError,
  type ApplicationDetail,
  type CampaignDetail,
  type NewApplication,
  type RunnerRepository,
  type WalletDistribution,
} from "./repository";
import { computeDistributionRow, filterAndSortCampaigns, generateReference, slugify, sumDistributedTokens, TOKEN_CALC_DECIMALS } from "./shared";

/**
 * In-memory store, seeded with DEMO DATA. State lives for the lifetime of the
 * server process (it resets on restart / redeploy). Attached to globalThis so
 * dev-mode hot reloads don't wipe it.
 */
const globalStore = globalThis as unknown as { __runnerDemoStore?: DemoSeed };
function store(): DemoSeed {
  if (!globalStore.__runnerDemoStore) globalStore.__runnerDemoStore = createDemoSeed();
  return globalStore.__runnerDemoStore;
}

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${globalThis.crypto.randomUUID()}`;
const clone = <T>(v: T): T => structuredClone(v);

function campaignDetail(s: DemoSeed, campaign: Campaign): CampaignDetail {
  const purchases = s.purchases.filter((p) => p.campaignId === campaign.id);
  const dists = s.distributions.filter((d) => d.campaignId === campaign.id);
  const screening = campaign.applicationId ? s.screenings.find((x) => x.applicationId === campaign.applicationId) ?? null : null;
  return clone({
    campaign,
    screening,
    purchases,
    distributionSummary: {
      recipientCount: dists.length,
      totalRewardTokens: fromBaseUnits(sumDistributedTokens(dists), TOKEN_CALC_DECIMALS, 4),
      status: dists.length === 0 ? "not_started" : dists.every((d) => d.distributionStatus === "confirmed") ? "verified" : "simulated",
    },
  });
}

export class DemoRepository implements RunnerRepository {
  readonly mode = "demo" as const;

  async listCampaigns(opts?: Parameters<RunnerRepository["listCampaigns"]>[0]) {
    return clone(filterAndSortCampaigns(store().campaigns, opts));
  }

  async getCampaignDetail(slug: string) {
    const s = store();
    const c = s.campaigns.find((x) => x.slug === slug && x.status !== "cancelled");
    return c ? campaignDetail(s, c) : null;
  }

  async getPlatformStats() {
    const s = store();
    const live = s.campaigns.filter((c) => c.status !== "cancelled");
    return {
      totalCampaigns: live.length,
      projectsReviewed: s.applications.filter((a) => a.status === "approved" || a.status === "rejected").length,
      tokensDistributed: new Set(s.distributions.map((d) => d.campaignId)).size,
      activeCampaigns: live.filter((c) => c.status === "active").length,
      source: "demo" as const,
    };
  }

  async getApplicationStatus(reference: string) {
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
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      campaignSlug: campaign && campaign.status !== "cancelled" ? campaign.slug : null,
    };
  }

  async getWalletDistributions(wallet: string): Promise<WalletDistribution[]> {
    const s = store();
    return clone(
      s.distributions
        .filter((d) => d.walletAddress === wallet)
        .map((d) => {
          const c = s.campaigns.find((x) => x.id === d.campaignId)!;
          return { ...d, campaign: { slug: c.slug, projectName: c.projectName, ticker: c.ticker, status: c.status } };
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    );
  }

  async createApplication(input: NewApplication): Promise<Application> {
    const s = store();
    const dup = s.applications.find(
      (a) => a.contractAddress === input.contractAddress && (a.status === "submitted" || a.status === "under_review"),
    );
    if (dup) throw new RepositoryError("An application for this contract address is already pending review.", "conflict");
    let reference = generateReference();
    while (s.applications.some((a) => a.reference === reference)) reference = generateReference();
    const t = now();
    const app: Application = {
      ...input,
      id: id("app"),
      reference,
      status: "submitted",
      paymentStatus: "test_mode_simulated",
      createdAt: t,
      updatedAt: t,
      source: "demo",
    };
    s.applications.push(app);
    return clone(app);
  }

  async getAdminOverview() {
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

  async listApplications(opts: { search?: string; status?: ApplicationStatus | "all" } = {}) {
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

  async getApplicationDetail(appId: string): Promise<ApplicationDetail | null> {
    const s = store();
    const application = s.applications.find((a) => a.id === appId);
    if (!application) return null;
    return clone({
      application,
      screening: s.screenings.find((x) => x.applicationId === appId) ?? null,
      campaign: s.campaigns.find((c) => c.applicationId === appId) ?? null,
    });
  }

  async saveScreening(applicationId: string, input: ScreeningInput, reviewer: string): Promise<Screening> {
    const s = store();
    const app = s.applications.find((a) => a.id === applicationId);
    if (!app) throw new RepositoryError("Application not found", "not_found");
    const existing = s.screenings.findIndex((x) => x.applicationId === applicationId);
    const screening: Screening = {
      ...(input as Omit<Screening, "id" | "applicationId" | "reviewedBy" | "createdAt">),
      id: existing >= 0 ? s.screenings[existing]!.id : id("scr"),
      applicationId,
      reviewedBy: reviewer,
      createdAt: now(),
    };
    if (existing >= 0) s.screenings[existing] = screening;
    else s.screenings.push(screening);
    if (app.status === "submitted") {
      app.status = "under_review";
      app.updatedAt = now();
    }
    return clone(screening);
  }

  async setApplicationStatus(applicationId: string, status: ApplicationStatus) {
    const s = store();
    const app = s.applications.find((a) => a.id === applicationId);
    if (!app) throw new RepositoryError("Application not found", "not_found");
    if (status === "approved" && !s.screenings.some((x) => x.applicationId === applicationId)) {
      throw new RepositoryError("Save a screening report before approving.", "invalid_state");
    }
    if (status === "rejected" && s.campaigns.some((c) => c.applicationId === applicationId && c.status !== "cancelled")) {
      throw new RepositoryError("Cancel the linked campaign before rejecting this application.", "invalid_state");
    }
    app.status = status;
    app.updatedAt = now();
    return clone(app);
  }

  async createCampaignFromApplication(applicationId: string, opts: { status: Campaign["status"]; featured: boolean; snapshotAt: string | null }) {
    const s = store();
    const app = s.applications.find((a) => a.id === applicationId);
    if (!app) throw new RepositoryError("Application not found", "not_found");
    if (app.status !== "approved") throw new RepositoryError("Only approved applications can become campaigns.", "invalid_state");
    if (s.campaigns.some((c) => c.applicationId === applicationId)) {
      throw new RepositoryError("A campaign already exists for this application.", "conflict");
    }
    const screening = s.screenings.find((x) => x.applicationId === applicationId);
    const alloc = calculateCampaignAllocation(CAMPAIGN_PACKAGES[app.campaignPackage].feeUsdCents);
    let slug = slugify(app.projectName);
    if (s.campaigns.some((c) => c.slug === slug)) slug = `${slug}-${app.reference.slice(4).toLowerCase()}`;
    const t = now();
    const campaign: Campaign = {
      id: id("cmp"),
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
      eligibleSupply: null,
      createdAt: t,
      updatedAt: t,
      source: "demo",
    };
    s.campaigns.push(campaign);
    return clone(campaign);
  }

  async listAllCampaigns() {
    return clone([...store().campaigns].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  }

  async getCampaignById(campaignId: string) {
    const s = store();
    const c = s.campaigns.find((x) => x.id === campaignId);
    return c ? campaignDetail(s, c) : null;
  }

  async updateCampaign(campaignId: string, input: CampaignUpdateInput) {
    const s = store();
    const c = s.campaigns.find((x) => x.id === campaignId);
    if (!c) throw new RepositoryError("Campaign not found", "not_found");
    const hasDistributions = s.distributions.some((d) => d.campaignId === campaignId);
    if (hasDistributions && input.eligibleSupply !== c.eligibleSupply) {
      throw new RepositoryError("Eligible supply is locked once distributions are recorded.", "invalid_state");
    }
    Object.assign(c, input, { updatedAt: now() });
    return clone(c);
  }

  async recordPurchase(campaignId: string, input: { usdcSpentCents: number; tokenAmount: string; notes: string }) {
    const s = store();
    const c = s.campaigns.find((x) => x.id === campaignId);
    if (!c) throw new RepositoryError("Campaign not found", "not_found");
    const spent = s.purchases.filter((p) => p.campaignId === campaignId).reduce((sum, p) => sum + p.usdcSpentCents, 0);
    if (spent + input.usdcSpentCents > c.rewardAllocationCents) {
      throw new RepositoryError("Total purchases cannot exceed the campaign's 70% reward allocation.", "invalid_state");
    }
    const purchase: TreasuryPurchase = {
      id: id("buy"),
      campaignId,
      usdcSpentCents: input.usdcSpentCents,
      tokenAmount: input.tokenAmount,
      status: "simulated",
      transactionSignature: null,
      notes: input.notes,
      executedAt: now(),
      source: "demo",
    };
    s.purchases.push(purchase);
    return clone(purchase);
  }

  async recordDistribution(campaignId: string, input: { walletAddress: string; runnerBalance: string }): Promise<Distribution> {
    const s = store();
    const campaign = s.campaigns.find((x) => x.id === campaignId);
    if (!campaign) throw new RepositoryError("Campaign not found", "not_found");
    const row = computeDistributionRow({
      campaign,
      purchases: s.purchases.filter((p) => p.campaignId === campaignId),
      existing: s.distributions.filter((d) => d.campaignId === campaignId),
      ...input,
    });
    const dist: Distribution = { ...row, id: id("dist"), createdAt: now(), source: "demo" };
    s.distributions.push(dist);
    return clone(dist);
  }

  async listDistributions(campaignId: string) {
    return clone(store().distributions.filter((d) => d.campaignId === campaignId));
  }
}
