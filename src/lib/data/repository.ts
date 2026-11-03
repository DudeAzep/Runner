import type { CampaignPackageId } from "@/lib/economics/allocation";
import type { Application, ApplicationStatus, Campaign, Distribution, Screening, Snapshot, TokenReport, TreasuryPurchase } from "@/lib/types";

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
  paymentStatus: Application["paymentStatus"];
  paymentSignature: string | null;
  createdAt: string;
  updatedAt: string;
  campaignSlug: string | null;
}

export interface DistributionSummary {
  recipientCount: number;
  plannedCount: number;
  confirmedCount: number;
  simulatedCount: number;
  totalRewardTokens: string;
  status: "not_started" | "planned" | "in_progress" | "simulated" | "verified";
}

export interface CampaignDetail {
  campaign: Campaign;
  screening: Screening | null;
  purchases: TreasuryPurchase[];
  snapshot: Snapshot | null;
  distributionSummary: DistributionSummary;
}

export interface ApplicationDetail {
  application: Application;
  screening: Screening | null;
  campaign: Campaign | null;
  tokenReport: TokenReport | null;
}

export interface WalletDistribution extends Distribution {
  campaign: Pick<Campaign, "slug" | "projectName" | "ticker" | "status">;
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
