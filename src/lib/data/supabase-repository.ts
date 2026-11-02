import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CAMPAIGN_PACKAGES, sumAllocations } from "@/lib/economics/allocation";
import { fromBaseUnits } from "@/lib/economics/rewards";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient, createSupabaseSessionClient } from "@/lib/supabase/server";
import type {
  Application,
  ApplicationStatus,
  Campaign,
  CampaignPackageId,
  Distribution,
  Screening,
  TreasuryPurchase,
} from "@/lib/types";
import type { CampaignUpdateInput, ScreeningInput } from "@/lib/validation/schemas";
import {
  RepositoryError,
  type ApplicationDetail,
  type CampaignDetail,
  type NewApplication,
  type PublicApplicationStatus,
  type RunnerRepository,
  type WalletDistribution,
} from "./repository";
import { computeDistributionRow, filterAndSortCampaigns, generateReference, slugify, sumDistributedTokens, TOKEN_CALC_DECIMALS } from "./shared";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const src = (r: Row) => (r.is_demo ? "demo" : "verified") as "demo" | "verified";

function toApplication(r: Row): Application {
  return {
    id: r.id,
    reference: r.reference,
    projectName: r.project_name,
    ticker: r.ticker,
    contractAddress: r.contract_address,
    website: r.website,
    twitter: r.twitter,
    telegram: r.telegram,
    discord: r.discord,
    description: r.description,
    applicantWallet: r.applicant_wallet,
    campaignPackage: r.campaign_package,
    status: r.application_status,
    paymentStatus: r.payment_status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    source: r.is_demo ? "demo" : "verified",
  };
}

function toScreening(r: Row): Screening {
  return {
    id: r.id,
    applicationId: r.application_id,
    liquidityScore: r.liquidity_score,
    holderDistributionScore: r.holder_distribution_score,
    developerActivityScore: r.developer_activity_score,
    communityScore: r.community_score,
    tradingActivityScore: r.trading_activity_score,
    tokenAuthoritiesScore: r.token_authorities_score,
    tokenomicsScore: r.tokenomics_score,
    manipulationScore: r.manipulation_score,
    marketCapUsd: num(r.market_cap_usd),
    liquidityUsd: num(r.liquidity_usd),
    holderCount: num(r.holder_count),
    top10HolderPct: num(r.top10_holder_pct),
    mintAuthorityRevoked: r.mint_authority_revoked,
    freezeAuthorityRevoked: r.freeze_authority_revoked,
    riskFlags: r.risk_flags ?? [],
    screeningNotes: r.screening_notes ?? "",
    recommendation: r.recommendation,
    riskLevel: r.risk_level,
    reviewedBy: r.reviewer_label || "RUNNER Screening",
    createdAt: r.updated_at ?? r.created_at,
  };
}

function toCampaign(r: Row): Campaign {
  return {
    id: r.id,
    slug: r.slug,
    applicationId: r.application_id,
    projectName: r.project_name,
    ticker: r.ticker,
    tokenAddress: r.token_address,
    description: r.description,
    website: r.website,
    twitter: r.twitter,
    telegram: r.telegram,
    discord: r.discord,
    campaignPackage: r.campaign_package,
    totalCampaignFeeCents: Number(r.total_campaign_fee),
    rewardAllocationCents: Number(r.reward_allocation),
    operationsAllocationCents: Number(r.operations_allocation),
    reserveAllocationCents: Number(r.reserve_allocation),
    status: r.campaign_status,
    featured: r.featured,
    riskLevel: r.risk_level,
    screeningDate: r.screening_date,
    marketCapAtScreeningUsd: num(r.market_cap_at_screening_usd),
    liquidityAtScreeningUsd: num(r.liquidity_at_screening_usd),
    holderCountAtScreening: num(r.holder_count_at_screening),
    snapshotAt: r.snapshot_at,
    eligibleSupply: r.eligible_supply === null ? null : String(r.eligible_supply),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    source: src(r),
  };
}

function toPurchase(r: Row): TreasuryPurchase {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    usdcSpentCents: Number(r.usdc_spent_cents),
    tokenAmount: String(r.token_amount),
    status: r.purchase_status,
    transactionSignature: r.transaction_signature,
    notes: r.notes,
    executedAt: r.executed_at,
    source: src(r),
  };
}

function toDistribution(r: Row): Distribution {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    walletAddress: r.wallet_address,
    runnerBalance: String(r.runner_balance),
    eligibleSupply: String(r.eligible_supply),
    rewardPercentage: Number(r.reward_percentage),
    rewardAmount: String(r.reward_amount),
    distributionStatus: r.distribution_status,
    transactionSignature: r.transaction_signature,
    createdAt: r.created_at,
    source: src(r),
  };
}

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) {
    if (res.error.code === "23505") throw new RepositoryError(`${what}: duplicate record`, "conflict");
    if (res.error.code === "23514") throw new RepositoryError(`${what}: ${res.error.message}`, "invalid_state");
    throw new RepositoryError(`${what} failed: ${res.error.message}`, "storage");
  }
  return res.data as T;
}

export class SupabaseRepository implements RunnerRepository {
  readonly mode = "supabase" as const;

  private pub(): SupabaseClient {
    return createSupabasePublicClient();
  }
  /** Admin operations run as the signed-in admin so RLS is enforced too. */
  private session(): Promise<SupabaseClient> {
    return createSupabaseSessionClient();
  }

  async listCampaigns(opts?: Parameters<RunnerRepository["listCampaigns"]>[0]) {
    const rows = check(await this.pub().from("campaigns").select("*").neq("campaign_status", "cancelled"), "List campaigns");
    return filterAndSortCampaigns((rows as Row[]).map(toCampaign), opts);
  }

  private async detail(client: SupabaseClient, campaign: Campaign): Promise<CampaignDetail> {
    const [scr, buys, dists] = await Promise.all([
      campaign.applicationId
        ? client.from("screening").select("*").eq("application_id", campaign.applicationId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      client.from("treasury_purchases").select("*").eq("campaign_id", campaign.id).order("executed_at", { ascending: false }),
      client.from("distributions").select("*").eq("campaign_id", campaign.id),
    ]);
    const distributions = (check(dists, "Load distributions") as Row[]).map(toDistribution);
    const s = check(scr, "Load screening") as Row | null;
    return {
      campaign,
      screening: s ? toScreening(s) : null,
      purchases: (check(buys, "Load purchases") as Row[]).map(toPurchase),
      distributionSummary: {
        recipientCount: distributions.length,
        totalRewardTokens: fromBaseUnits(sumDistributedTokens(distributions), TOKEN_CALC_DECIMALS, 4),
        status:
          distributions.length === 0
            ? "not_started"
            : distributions.every((d) => d.distributionStatus === "confirmed")
              ? "verified"
              : "simulated",
      },
    };
  }

  async getCampaignDetail(slug: string) {
    const client = this.pub();
    const row = check(await client.from("campaigns").select("*").eq("slug", slug).neq("campaign_status", "cancelled").maybeSingle(), "Load campaign");
    return row ? this.detail(client, toCampaign(row as Row)) : null;
  }

  async getPlatformStats() {
    const client = createSupabaseServiceClient(); // aggregate counts only; no row data leaves the server
    const [camps, reviewed, dists] = await Promise.all([
      client.from("campaigns").select("campaign_status, is_demo").neq("campaign_status", "cancelled"),
      client.from("applications").select("id", { count: "exact", head: true }).in("application_status", ["approved", "rejected"]),
      client.from("distributions").select("campaign_id"),
    ]);
    const c = check(camps, "Stats") as Row[];
    return {
      totalCampaigns: c.length,
      projectsReviewed: reviewed.count ?? 0,
      tokensDistributed: new Set((check(dists, "Stats") as Row[]).map((d) => d.campaign_id)).size,
      activeCampaigns: c.filter((x) => x.campaign_status === "active").length,
      source: (c.length > 0 && c.every((x) => !x.is_demo) ? "verified" : "demo") as "demo" | "verified",
    };
  }

  async getApplicationStatus(reference: string): Promise<PublicApplicationStatus | null> {
    const rows = check(await this.pub().rpc("get_application_status", { p_reference: reference }), "Lookup") as Row[] | null;
    const r = rows?.[0];
    if (!r) return null;
    return {
      reference: r.reference,
      projectName: r.project_name,
      ticker: r.ticker,
      campaignPackage: r.campaign_package,
      status: r.application_status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      campaignSlug: r.campaign_slug,
    };
  }

  async getWalletDistributions(wallet: string): Promise<WalletDistribution[]> {
    const rows = check(
      await this.pub()
        .from("distributions")
        .select("*, campaigns(slug, project_name, ticker, campaign_status)")
        .eq("wallet_address", wallet)
        .order("created_at", { ascending: false }),
      "Wallet distributions",
    ) as Row[];
    return rows.map((r) => ({
      ...toDistribution(r),
      campaign: {
        slug: r.campaigns?.slug,
        projectName: r.campaigns?.project_name,
        ticker: r.campaigns?.ticker,
        status: r.campaigns?.campaign_status,
      },
    }));
  }

  async createApplication(input: NewApplication): Promise<Application> {
    // Intake uses the service role AFTER server-side zod validation; anon has no insert grant.
    const client = createSupabaseServiceClient();
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await client
        .from("applications")
        .insert({
          reference: generateReference(),
          project_name: input.projectName,
          ticker: input.ticker,
          contract_address: input.contractAddress,
          website: input.website,
          twitter: input.twitter,
          telegram: input.telegram,
          discord: input.discord,
          description: input.description,
          applicant_wallet: input.applicantWallet,
          campaign_package: input.campaignPackage,
        })
        .select("*")
        .single();
      if (res.error?.code === "23505" && res.error.message.includes("reference")) continue; // retry on ref collision
      if (res.error?.code === "23505") {
        throw new RepositoryError("An application for this contract address is already pending review.", "conflict");
      }
      return toApplication(check(res, "Submit application") as Row);
    }
    throw new RepositoryError("Could not allocate a reference number. Please retry.", "storage");
  }

  async getAdminOverview() {
    const client = await this.session();
    const [apps, camps] = await Promise.all([
      client.from("applications").select("application_status"),
      client.from("campaigns").select("total_campaign_fee, reward_allocation, operations_allocation, reserve_allocation, campaign_status"),
    ]);
    const a = check(apps, "Overview") as Row[];
    const c = (check(camps, "Overview") as Row[]).filter((x) => x.campaign_status !== "cancelled");
    const totals = sumAllocations(
      c.map((x) => ({
        totalUsdCents: Number(x.total_campaign_fee),
        rewardUsdCents: Number(x.reward_allocation),
        operationsUsdCents: Number(x.operations_allocation),
        reserveUsdCents: Number(x.reserve_allocation),
      })),
    );
    return {
      totalApplications: a.length,
      pendingApplications: a.filter((x) => x.application_status === "submitted" || x.application_status === "under_review").length,
      approvedCampaigns: c.length,
      rejectedApplications: a.filter((x) => x.application_status === "rejected").length,
      simulatedRevenueCents: totals.totalUsdCents,
      simulatedRewardAllocationCents: totals.rewardUsdCents,
      simulatedOperationsCents: totals.operationsUsdCents,
      simulatedReserveCents: totals.reserveUsdCents,
    };
  }

  async listApplications(opts: { search?: string; status?: ApplicationStatus | "all" } = {}) {
    const client = await this.session();
    let q = client.from("applications").select("*").order("created_at", { ascending: false }).limit(500);
    if (opts.status && opts.status !== "all") q = q.eq("application_status", opts.status);
    const rows = (check(await q, "List applications") as Row[]).map(toApplication);
    const s = opts.search?.trim().toLowerCase();
    return s
      ? rows.filter((a) => [a.projectName, a.ticker, a.reference, a.contractAddress, a.applicantWallet].some((f) => f.toLowerCase().includes(s)))
      : rows;
  }

  async getApplicationDetail(id: string): Promise<ApplicationDetail | null> {
    const client = await this.session();
    const app = check(await client.from("applications").select("*").eq("id", id).maybeSingle(), "Load application") as Row | null;
    if (!app) return null;
    const [scr, camp] = await Promise.all([
      client.from("screening").select("*").eq("application_id", id).maybeSingle(),
      client.from("campaigns").select("*").eq("application_id", id).maybeSingle(),
    ]);
    const s = check(scr, "Load screening") as Row | null;
    const c = check(camp, "Load campaign") as Row | null;
    return { application: toApplication(app), screening: s ? toScreening(s) : null, campaign: c ? toCampaign(c) : null };
  }

  async saveScreening(applicationId: string, input: ScreeningInput, reviewer: string): Promise<Screening> {
    const client = await this.session();
    const { data: auth } = await client.auth.getUser();
    const me = auth.user
      ? ((await client.from("users").select("id").eq("auth_user_id", auth.user.id).maybeSingle()).data as Row | null)
      : null;
    const row = check(
      await client
        .from("screening")
        .upsert(
          {
            application_id: applicationId,
            liquidity_score: input.liquidityScore,
            holder_distribution_score: input.holderDistributionScore,
            developer_activity_score: input.developerActivityScore,
            community_score: input.communityScore,
            trading_activity_score: input.tradingActivityScore,
            token_authorities_score: input.tokenAuthoritiesScore,
            tokenomics_score: input.tokenomicsScore,
            manipulation_score: input.manipulationScore,
            market_cap_usd: input.marketCapUsd,
            liquidity_usd: input.liquidityUsd,
            holder_count: input.holderCount,
            top10_holder_pct: input.top10HolderPct,
            mint_authority_revoked: input.mintAuthorityRevoked,
            freeze_authority_revoked: input.freezeAuthorityRevoked,
            risk_flags: input.riskFlags,
            screening_notes: input.screeningNotes,
            recommendation: input.recommendation,
            risk_level: input.riskLevel,
            reviewed_by: me?.id ?? null,
            reviewer_label: reviewer,
          },
          { onConflict: "application_id" },
        )
        .select("*")
        .single(),
      "Save screening",
    ) as Row;
    await client.from("applications").update({ application_status: "under_review" }).eq("id", applicationId).eq("application_status", "submitted");
    return toScreening(row);
  }

  async setApplicationStatus(applicationId: string, status: ApplicationStatus) {
    const client = await this.session();
    if (status === "approved") {
      const s = await client.from("screening").select("id").eq("application_id", applicationId).maybeSingle();
      if (!s.data) throw new RepositoryError("Save a screening report before approving.", "invalid_state");
    }
    if (status === "rejected") {
      const c = await client.from("campaigns").select("id").eq("application_id", applicationId).neq("campaign_status", "cancelled").maybeSingle();
      if (c.data) throw new RepositoryError("Cancel the linked campaign before rejecting this application.", "invalid_state");
    }
    const row = check(
      await client.from("applications").update({ application_status: status }).eq("id", applicationId).select("*").single(),
      "Update application",
    ) as Row;
    return toApplication(row);
  }

  async createCampaignFromApplication(applicationId: string, opts: { status: Campaign["status"]; featured: boolean; snapshotAt: string | null }) {
    const detail = await this.getApplicationDetail(applicationId);
    if (!detail) throw new RepositoryError("Application not found", "not_found");
    const { application: app, screening } = detail;
    if (app.status !== "approved") throw new RepositoryError("Only approved applications can become campaigns.", "invalid_state");
    if (detail.campaign) throw new RepositoryError("A campaign already exists for this application.", "conflict");
    const client = await this.session();
    const base = slugify(app.projectName);
    const taken = await client.from("campaigns").select("id").eq("slug", base).maybeSingle();
    const slug = taken.data ? `${base}-${app.reference.slice(4).toLowerCase()}` : base;
    const pkg = app.campaignPackage as CampaignPackageId;
    const row = check(
      await client
        .from("campaigns")
        .insert({
          slug,
          application_id: app.id,
          project_name: app.projectName,
          ticker: app.ticker,
          token_address: app.contractAddress,
          description: app.description,
          website: app.website,
          twitter: app.twitter,
          telegram: app.telegram,
          discord: app.discord,
          campaign_package: pkg,
          total_campaign_fee: CAMPAIGN_PACKAGES[pkg].feeUsdCents,
          campaign_status: opts.status,
          featured: opts.featured,
          risk_level: screening?.riskLevel ?? "elevated",
          screening_date: screening?.createdAt ?? new Date().toISOString(),
          market_cap_at_screening_usd: screening?.marketCapUsd ?? null,
          liquidity_at_screening_usd: screening?.liquidityUsd ?? null,
          holder_count_at_screening: screening?.holderCount ?? null,
          snapshot_at: opts.snapshotAt,
        })
        .select("*")
        .single(),
      "Create campaign",
    ) as Row;
    return toCampaign(row);
  }

  async listAllCampaigns() {
    const client = await this.session();
    const rows = check(await client.from("campaigns").select("*").order("created_at", { ascending: false }), "List campaigns") as Row[];
    return rows.map(toCampaign);
  }

  async getCampaignById(id: string) {
    const client = await this.session();
    const row = check(await client.from("campaigns").select("*").eq("id", id).maybeSingle(), "Load campaign") as Row | null;
    return row ? this.detail(client, toCampaign(row)) : null;
  }

  async updateCampaign(id: string, input: CampaignUpdateInput) {
    const client = await this.session();
    const current = await this.getCampaignById(id);
    if (!current) throw new RepositoryError("Campaign not found", "not_found");
    if (current.distributionSummary.recipientCount > 0 && input.eligibleSupply !== current.campaign.eligibleSupply) {
      throw new RepositoryError("Eligible supply is locked once distributions are recorded.", "invalid_state");
    }
    const row = check(
      await client
        .from("campaigns")
        .update({
          description: input.description,
          campaign_status: input.status,
          risk_level: input.riskLevel,
          featured: input.featured,
          snapshot_at: input.snapshotAt,
          eligible_supply: input.eligibleSupply,
        })
        .eq("id", id)
        .select("*")
        .single(),
      "Update campaign",
    ) as Row;
    return toCampaign(row);
  }

  async recordPurchase(campaignId: string, input: { usdcSpentCents: number; tokenAmount: string; notes: string }) {
    const client = await this.session();
    const row = check(
      await client
        .from("treasury_purchases")
        .insert({
          campaign_id: campaignId,
          usdc_spent_cents: input.usdcSpentCents,
          token_amount: input.tokenAmount,
          notes: input.notes,
          purchase_status: "simulated",
        })
        .select("*")
        .single(),
      "Record purchase",
    ) as Row;
    return toPurchase(row);
  }

  async recordDistribution(campaignId: string, input: { walletAddress: string; runnerBalance: string }) {
    const detail = await this.getCampaignById(campaignId);
    if (!detail) throw new RepositoryError("Campaign not found", "not_found");
    const existing = await this.listDistributions(campaignId);
    const row = computeDistributionRow({ campaign: detail.campaign, purchases: detail.purchases, existing, ...input });
    const client = await this.session();
    const saved = check(
      await client
        .from("distributions")
        .insert({
          campaign_id: row.campaignId,
          wallet_address: row.walletAddress,
          runner_balance: row.runnerBalance,
          eligible_supply: row.eligibleSupply,
          reward_percentage: row.rewardPercentage,
          reward_amount: row.rewardAmount,
          distribution_status: "simulated",
        })
        .select("*")
        .single(),
      "Record distribution",
    ) as Row;
    return toDistribution(saved);
  }

  async listDistributions(campaignId: string) {
    const client = await this.session();
    const rows = check(await client.from("distributions").select("*").eq("campaign_id", campaignId).order("created_at"), "List distributions") as Row[];
    return rows.map(toDistribution);
  }
}
