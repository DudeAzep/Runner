import type { CampaignPackageId } from "@/lib/economics/allocation";

export type { CampaignPackageId };

/**
 * Where a record came from.
 * - demo:     fictional sample data shipped with the app
 * - manual:   real record, but figures were entered by hand / simulated
 * - verified: backed by on-chain data or a confirmed transaction signature
 */
export type DataSource = "demo" | "manual" | "verified";

export type UserRole = "holder" | "project" | "admin";

export type ApplicationStatus = "submitted" | "under_review" | "approved" | "rejected";
export const APPLICATION_STATUSES: ApplicationStatus[] = ["submitted", "under_review", "approved", "rejected"];

export type CampaignStatus = "upcoming" | "active" | "completed" | "cancelled";
export const CAMPAIGN_STATUSES: CampaignStatus[] = ["upcoming", "active", "completed", "cancelled"];

export type RiskLevel = "low" | "moderate" | "elevated" | "high";
export const RISK_LEVELS: RiskLevel[] = ["low", "moderate", "elevated", "high"];

export type ScreeningRecommendation = "approve" | "reject" | "needs_info";

export type PaymentStatus = "test_mode_simulated" | "awaiting_payment" | "paid";

/**
 * planned   → in a distribution plan, not yet sent
 * submitted → included in a signed transaction that was sent (signature stored)
 * confirmed → verified on-chain
 * simulated → marked as sent in TEST MODE (no transaction)
 * skipped   → below minimum reward
 */
export type DistributionStatus = "planned" | "submitted" | "confirmed" | "simulated" | "skipped";

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
  /** USDC payment transaction (live mode only). */
  paymentSignature: string | null;
  paymentPayer: string | null;
  paidAt: string | null;
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
  /** Latest eligibility snapshot taken for this campaign. */
  snapshotId: string | null;
  /** Eligible RUNNER supply at the snapshot, raw base units (string for bigint safety). */
  eligibleSupply: string | null;
  /** Decimals of RUNNER balances in the snapshot (0 for demo data). */
  runnerDecimals: number;
  /** Decimals of the project (reward) token, once known. */
  rewardDecimals: number | null;
  createdAt: string;
  updatedAt: string;
  source: DataSource;
}

export interface TreasuryPurchase {
  id: string;
  campaignId: string;
  /** USDC spent, in cents. */
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
  snapshotId: string | null;
  walletAddress: string;
  /** Holder RUNNER balance at snapshot, raw base units. */
  runnerBalance: string;
  eligibleSupply: string;
  runnerDecimals: number;
  rewardPercentage: number;
  /** Reward token amount, decimal string (display). */
  rewardAmount: string;
  /** Reward token amount in base units (what is actually transferred). */
  rewardAmountRaw: string;
  rewardDecimals: number;
  distributionStatus: DistributionStatus;
  /** Only set for real on-chain transfers. Never fabricated. */
  transactionSignature: string | null;
  createdAt: string;
  updatedAt: string;
  source: DataSource;
}

export interface Snapshot {
  id: string;
  campaignId: string;
  takenAt: string;
  method: "rpc" | "csv" | "demo";
  runnerMint: string | null;
  slot: number | null;
  runnerDecimals: number;
  /** Raw base units. */
  eligibleSupply: string;
  holderCount: number;
  excludedWallets: string[];
  source: DataSource;
}

export interface SnapshotHolders {
  /** Same id as the snapshot. */
  id: string;
  holders: { wallet: string; balance: string }[];
}

export interface TokenReport {
  id: string;
  /** Application this report was fetched for. */
  applicationId: string;
  mint: string;
  fetchedAt: string;
  tokenProgram: string | null;
  decimals: number | null;
  supply: string | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  top10Pct: number | null;
  largestAccounts: { address: string; amount: string; pct: number }[];
  priceUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  pairUrl: string | null;
  pairCreatedAt: string | null;
  holderCount: number | null;
  errors: string[];
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
