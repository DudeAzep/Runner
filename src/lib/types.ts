import type { CampaignPackageId } from "@/lib/economics/allocation";

export type { CampaignPackageId };

/** Where a record came from. Only "verified" may be presented as live on-chain data. */
export type DataSource = "demo" | "verified";

export type UserRole = "holder" | "project" | "admin";

export type ApplicationStatus = "submitted" | "under_review" | "approved" | "rejected";
export const APPLICATION_STATUSES: ApplicationStatus[] = ["submitted", "under_review", "approved", "rejected"];

export type CampaignStatus = "upcoming" | "active" | "completed" | "cancelled";
export const CAMPAIGN_STATUSES: CampaignStatus[] = ["upcoming", "active", "completed", "cancelled"];

export type RiskLevel = "low" | "moderate" | "elevated" | "high";
export const RISK_LEVELS: RiskLevel[] = ["low", "moderate", "elevated", "high"];

export type ScreeningRecommendation = "approve" | "reject" | "needs_info";

export type PaymentStatus = "test_mode_simulated" | "unpaid";

export type DistributionStatus = "simulated" | "pending" | "confirmed" | "failed";

export type PurchaseStatus = "simulated" | "pending" | "confirmed";

export interface ProjectLinks {
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
}

export interface Application extends ProjectLinks {
  id: string;
  reference: string;
  projectName: string;
  ticker: string;
  contractAddress: string;
  description: string;
  applicantWallet: string;
  campaignPackage: CampaignPackageId;
  status: ApplicationStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  source: DataSource;
}

/** Each screening criterion is scored 0–10, where 10 = strongest / lowest risk. */
export interface ScreeningScores {
  liquidityScore: number;
  holderDistributionScore: number;
  developerActivityScore: number;
  communityScore: number;
  tradingActivityScore: number;
  tokenAuthoritiesScore: number;
  tokenomicsScore: number;
  manipulationScore: number;
}

export const SCREENING_CRITERIA: { key: keyof ScreeningScores; label: string; hint: string }[] = [
  { key: "liquidityScore", label: "Liquidity assessment", hint: "Pool depth, LP lock/burn status, slippage at size." },
  { key: "holderDistributionScore", label: "Holder concentration", hint: "Top-10 / top-50 share, team & insider wallets, clusters." },
  { key: "developerActivityScore", label: "Developer activity", hint: "Shipping cadence, public repos, responsiveness, doxx level." },
  { key: "communityScore", label: "Community authenticity", hint: "Organic engagement vs. bot follows, raid farms, paid shills." },
  { key: "tradingActivityScore", label: "Trading volume", hint: "Organic volume, wash-trading patterns, unique traders." },
  { key: "tokenAuthoritiesScore", label: "Token authorities", hint: "Mint & freeze authority revoked, metadata mutability." },
  { key: "tokenomicsScore", label: "Tokenomics", hint: "Supply, allocations, vesting, taxes / transfer hooks." },
  { key: "manipulationScore", label: "Manipulation indicators", hint: "Bundled launches, sniper clusters, coordinated dumps. 10 = none found." },
];

export const RISK_FLAG_OPTIONS = [
  "Mint authority active",
  "Freeze authority active",
  "Mutable metadata",
  "LP not locked or burned",
  "Top 10 holders > 30%",
  "Bundled launch detected",
  "Sniper cluster detected",
  "Suspected wash trading",
  "Inorganic social growth",
  "Anonymous team",
  "Transfer tax / hook present",
  "Recent large deployer sell",
] as const;

export interface ScreeningMetrics {
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  holderCount: number | null;
  top10HolderPct: number | null;
  mintAuthorityRevoked: boolean | null;
  freezeAuthorityRevoked: boolean | null;
}

export interface Screening extends ScreeningScores, ScreeningMetrics {
  id: string;
  applicationId: string;
  riskFlags: string[];
  screeningNotes: string;
  recommendation: ScreeningRecommendation;
  riskLevel: RiskLevel;
  reviewedBy: string;
  createdAt: string;
}

export interface Campaign extends ProjectLinks {
  id: string;
  slug: string;
  applicationId: string | null;
  projectName: string;
  ticker: string;
  tokenAddress: string;
  description: string;
  campaignPackage: CampaignPackageId;
  totalCampaignFeeCents: number;
  rewardAllocationCents: number;
  operationsAllocationCents: number;
  reserveAllocationCents: number;
  status: CampaignStatus;
  featured: boolean;
  riskLevel: RiskLevel;
  screeningDate: string;
  marketCapAtScreeningUsd: number | null;
  liquidityAtScreeningUsd: number | null;
  holderCountAtScreening: number | null;
  /** Planned or actual eligibility snapshot time. */
  snapshotAt: string | null;
  /** Eligible RUNNER supply at the snapshot, in whole tokens (string for bigint safety). */
  eligibleSupply: string | null;
  createdAt: string;
  updatedAt: string;
  source: DataSource;
}

export interface TreasuryPurchase {
  id: string;
  campaignId: string;
  usdcSpentCents: number;
  /** Amount of project tokens acquired, decimal string. */
  tokenAmount: string;
  status: PurchaseStatus;
  /** Only set for verified on-chain purchases. Never fabricated. */
  transactionSignature: string | null;
  notes: string;
  executedAt: string;
  source: DataSource;
}

export interface Distribution {
  id: string;
  campaignId: string;
  walletAddress: string;
  runnerBalance: string;
  eligibleSupply: string;
  rewardPercentage: number;
  /** Reward token amount, decimal string. */
  rewardAmount: string;
  distributionStatus: DistributionStatus;
  /** Only set for verified on-chain transfers. Never fabricated. */
  transactionSignature: string | null;
  createdAt: string;
  source: DataSource;
}

export interface PlatformStats {
  totalCampaigns: number;
  projectsReviewed: number;
  tokensDistributed: number;
  activeCampaigns: number;
  source: DataSource;
}

export interface AdminOverview {
  totalApplications: number;
  pendingApplications: number;
  approvedCampaigns: number;
  rejectedApplications: number;
  simulatedRevenueCents: number;
  simulatedRewardAllocationCents: number;
  simulatedOperationsCents: number;
  simulatedReserveCents: number;
}

export type CampaignSort = "recent" | "market_cap" | "allocation";
export type CampaignFilter = "all" | "approved" | "upcoming" | "completed";
