import type { CampaignPackageId } from "@/lib/economics/allocation";
import type {
  AdminOverview,
  Application,
  ApplicationStatus,
  Campaign,
  CampaignFilter,
  CampaignSort,
  CampaignStatus,
  Distribution,
  PlatformStats,
  Screening,
  TreasuryPurchase,
} from "@/lib/types";
import type { CampaignUpdateInput, ScreeningInput } from "@/lib/validation/schemas";

export interface NewApplication {
  projectName: string;
  ticker: string;
  contractAddress: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  description: string;
  applicantWallet: string;
  campaignPackage: CampaignPackageId;
}

export interface PublicApplicationStatus {
  reference: string;
  projectName: string;
  ticker: string;
  campaignPackage: CampaignPackageId;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  campaignSlug: string | null;
}

export interface CampaignDetail {
  campaign: Campaign;
  screening: Screening | null;
  purchases: TreasuryPurchase[];
  distributionSummary: {
    recipientCount: number;
    totalRewardTokens: string;
    status: "not_started" | "simulated" | "verified";
  };
}

export interface ApplicationDetail {
  application: Application;
  screening: Screening | null;
  campaign: Campaign | null;
}

export interface WalletDistribution extends Distribution {
  campaign: Pick<Campaign, "slug" | "projectName" | "ticker" | "status">;
}

/**
 * Storage-agnostic data access. Two implementations:
 *  - DemoRepository: in-memory, seeded with DEMO DATA (default, no setup needed)
 *  - SupabaseRepository: Postgres via Supabase (when env vars are configured)
 *
 * All mutating methods are server-only and are called from server actions
 * AFTER admin authorization has been verified.
 */
export interface RunnerRepository {
  readonly mode: "demo" | "supabase";

  // Public reads
  listCampaigns(opts?: { filter?: CampaignFilter; sort?: CampaignSort; search?: string }): Promise<Campaign[]>;
  getCampaignDetail(slug: string): Promise<CampaignDetail | null>;
  getPlatformStats(): Promise<PlatformStats>;
  getApplicationStatus(reference: string): Promise<PublicApplicationStatus | null>;
  getWalletDistributions(wallet: string): Promise<WalletDistribution[]>;

  // Public write (validated server-side before reaching here)
  createApplication(input: NewApplication): Promise<Application>;

  // Admin
  getAdminOverview(): Promise<AdminOverview>;
  listApplications(opts?: { search?: string; status?: ApplicationStatus | "all" }): Promise<Application[]>;
  getApplicationDetail(id: string): Promise<ApplicationDetail | null>;
  saveScreening(applicationId: string, input: ScreeningInput, reviewer: string): Promise<Screening>;
  setApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<Application>;
  createCampaignFromApplication(
    applicationId: string,
    opts: { status: CampaignStatus; featured: boolean; snapshotAt: string | null },
  ): Promise<Campaign>;
  listAllCampaigns(): Promise<Campaign[]>;
  getCampaignById(id: string): Promise<CampaignDetail | null>;
  updateCampaign(id: string, input: CampaignUpdateInput): Promise<Campaign>;
  recordPurchase(campaignId: string, input: { usdcSpentCents: number; tokenAmount: string; notes: string }): Promise<TreasuryPurchase>;
  recordDistribution(campaignId: string, input: { walletAddress: string; runnerBalance: string }): Promise<Distribution>;
  listDistributions(campaignId: string): Promise<Distribution[]>;
}

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "conflict" | "invalid_state" | "storage" = "storage",
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}
