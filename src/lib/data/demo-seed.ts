/**
 * DEMO DATA — every project, address, and figure below is FICTIONAL.
 *
 * - Project names are invented for illustration.
 * - Addresses are randomly generated 32-byte base58 strings; they are not
 *   associated with any real token or wallet.
 * - Market cap, liquidity, and holder counts are illustrative placeholders,
 *   not verified market data.
 * - No transaction signatures are included. Simulated purchases and
 *   distributions have `transactionSignature: null`.
 */
import { calculateCampaignAllocation, CAMPAIGN_PACKAGES, type CampaignPackageId } from "@/lib/economics/allocation";
import { calculateHolderReward, fromBaseUnits, toBaseUnits } from "@/lib/economics/rewards";
import type { Application, Campaign, Distribution, Screening, TreasuryPurchase } from "@/lib/types";

export const DEMO_WALLET = "DbF5KSt39LEiJEf2uZZTwzcNvxzVxUABHXHSuK6ZSghx";
export const DEMO_RUNNER_BALANCE = 250_000;
export const DEMO_ELIGIBLE_SUPPLY = 100_000_000;
export const REWARD_TOKEN_DECIMALS = 6;

const OTHER_DEMO_HOLDERS: { wallet: string; balance: number }[] = [
  { wallet: "FseP875vR2fVn9GNiMk4ExaCSeSmRaeqpBoFVAxQpqYp", balance: 1_200_000 },
  { wallet: "9nvnHm8SYgnJXbXH3SP4QtyADNprVLKmG84Gn4bxX6NQ", balance: 640_000 },
  { wallet: "HbEForh95LJQxFHb8DnfrRwa9x6wCKB96f5ApVgcVafK", balance: 85_000 },
  { wallet: "DMof2Z8k1THxGDfFrw6Pqaqwe4eJneWw4rL3nHhnNESc", balance: 4_200 },
];

interface SeedProject {
  slug: string;
  projectName: string;
  ticker: string;
  address: string;
  applicant: string;
  pkg: CampaignPackageId;
  description: string;
  mcap: number | null;
  liq: number | null;
  holders: number | null;
  top10: number | null;
  scores: [number, number, number, number, number, number, number, number];
  flags: string[];
  notes: string;
  risk: Campaign["riskLevel"];
  submitted: string;
  screened: string;
  campaign?: { status: Campaign["status"]; featured: boolean; snapshotAt: string | null };
  applicationStatus: Application["status"];
}

const PROJECTS: SeedProject[] = [
  {
    slug: "moonrunner",
    projectName: "MoonRunner",
    ticker: "MRUN",
    address: "2zFfqTWyQ1cky7MhSuQQBGQUy5JVpn9aYMZM5uUKx7q4",
    applicant: "HH7sYzByzcw65EAtt7kHC4U6YokDYudfM1TuFY91Ejcb",
    pkg: "featured",
    description:
      "A community-run Solana memecoin built around weekly on-chain running challenges. Fictional demo project used to illustrate a featured RUNNER campaign.",
    mcap: 1_840_000,
    liq: 212_000,
    holders: 4_812,
    top10: 18.4,
    scores: [8, 7, 7, 8, 7, 10, 7, 8],
    flags: ["Anonymous team"],
    notes:
      "LP burned at launch. Mint and freeze authority revoked. Top-10 concentration within threshold after excluding the LP. Team is pseudonymous but has a consistent public build log.",
    risk: "moderate",
    submitted: "2026-10-02T14:10:00Z",
    screened: "2026-10-06T16:30:00Z",
    campaign: { status: "active", featured: true, snapshotAt: "2026-11-08T00:00:00Z" },
    applicationStatus: "approved",
  },
  {
    slug: "examplecoin",
    projectName: "ExampleCoin",
    ticker: "EXMPL",
    address: "C3bpVHLcvxnxLByNKZD21e7DW2hp5nuBBYaQ6CynU5zS",
    applicant: "59c4Jtkt12JStD22Zf2cdLbvT26GHeEoQWesPL4Knaxi",
    pkg: "growth",
    description:
      "The reference demo project for RUNNER. ExampleCoin exists only to illustrate a complete campaign lifecycle from application to distribution.",
    mcap: 3_250_000,
    liq: 405_000,
    holders: 9_104,
    top10: 14.2,
    scores: [9, 8, 8, 8, 8, 10, 8, 9],
    flags: [],
    notes: "Strong liquidity relative to market cap. Authorities revoked. No bundled-launch signatures found in the first 200 slots.",
    risk: "low",
    submitted: "2026-08-28T09:00:00Z",
    screened: "2026-09-01T12:00:00Z",
    campaign: { status: "completed", featured: false, snapshotAt: "2026-09-15T00:00:00Z" },
    applicationStatus: "approved",
  },
  {
    slug: "solpup",
    projectName: "SolPup",
    ticker: "SPUP",
    address: "7HYDWnNVW7P6Cgyg7RkwLKULuW7WsXLZbWoi8k1hCd16",
    applicant: "4KncExE3CKzE3w71Z6FpYNg4yPH2tC8qJoNZvsFPmtR1",
    pkg: "growth",
    description: "A dog-themed community token with a focus on meme art contests. Fictional demo project.",
    mcap: 620_000,
    liq: 88_500,
    holders: 2_377,
    top10: 27.9,
    scores: [6, 5, 6, 6, 6, 10, 6, 6],
    flags: ["Anonymous team", "Recent large deployer sell"],
    notes:
      "Approved with elevated risk rating. Deployer sold ~2% of supply during week one. Holder concentration close to the 30% threshold. Monitor before snapshot.",
    risk: "elevated",
    submitted: "2026-10-10T18:45:00Z",
    screened: "2026-10-14T10:15:00Z",
    campaign: { status: "active", featured: false, snapshotAt: "2026-11-12T00:00:00Z" },
    applicationStatus: "approved",
  },
  {
    slug: "pixelsol",
    projectName: "PixelSol",
    ticker: "PXSOL",
    address: "HMCb5L21Ft6Tvw3HqmoRVhnK6yAZpJXHcqAhCkhzghnn",
    applicant: "9ceVFohASg4VGMdn51TjtcmbUuprfXmMvZQnoJzNS9ph",
    pkg: "featured",
    description: "Pixel-art collectible memecoin with an on-chain canvas mini-game. Fictional demo project.",
    mcap: 1_120_000,
    liq: 141_000,
    holders: null,
    top10: 21.0,
    scores: [7, 7, 8, 7, 6, 10, 7, 7],
    flags: ["Mutable metadata"],
    notes: "Metadata remains mutable for planned art updates; team committed to freezing after season one. Holder count unavailable at screening time.",
    risk: "moderate",
    submitted: "2026-10-18T11:20:00Z",
    screened: "2026-10-22T15:00:00Z",
    campaign: { status: "upcoming", featured: true, snapshotAt: "2026-11-20T00:00:00Z" },
    applicationStatus: "approved",
  },
  {
    slug: "novatrail",
    projectName: "NovaTrail",
    ticker: "NOVA",
    address: "HJzXbDY5X8jp2yAVEiFpg2xgPTovc8YFJN8GE7rNpbzm",
    applicant: "2zFfqTWyQ1cky7MhSuQQBGQUy5JVpn9aYMZM5uUKx7q4",
    pkg: "starter",
    description: "A space-exploration themed token with community-voted lore drops. Fictional demo project.",
    mcap: 410_000,
    liq: 61_000,
    holders: 1_650,
    top10: 22.5,
    scores: [7, 7, 6, 7, 6, 10, 7, 7],
    flags: ["Anonymous team"],
    notes: "Small but organic community. Liquidity adequate for a Starter allocation.",
    risk: "moderate",
    submitted: "2026-09-08T08:00:00Z",
    screened: "2026-09-11T13:40:00Z",
    campaign: { status: "completed", featured: false, snapshotAt: "2026-09-25T00:00:00Z" },
    applicationStatus: "approved",
  },
  {
    slug: "driftwave",
    projectName: "Driftwave",
    ticker: "DRIFT",
    address: "4KncExE3CKzE3w71Z6FpYNg4yPH2tC8qJoNZvsFPmtR1",
    applicant: "7HYDWnNVW7P6Cgyg7RkwLKULuW7WsXLZbWoi8k1hCd16",
    pkg: "starter",
    description: "Surf-culture memecoin with a music-sharing community. Fictional demo project.",
    mcap: 295_000,
    liq: 47_200,
    holders: 1_102,
    top10: 29.1,
    scores: [6, 5, 5, 6, 5, 10, 6, 6],
    flags: ["Top 10 holders > 30%", "Anonymous team"],
    notes: "Concentration borderline; approved for Starter tier only with elevated risk label.",
    risk: "elevated",
    submitted: "2026-10-20T20:00:00Z",
    screened: "2026-10-26T09:30:00Z",
    campaign: { status: "upcoming", featured: false, snapshotAt: "2026-11-25T00:00:00Z" },
    applicationStatus: "approved",
  },
  {
    slug: "quickflip",
    projectName: "QuickFlip",
    ticker: "QFLIP",
    address: "9ceVFohASg4VGMdn51TjtcmbUuprfXmMvZQnoJzNS9ph",
    applicant: "HMCb5L21Ft6Tvw3HqmoRVhnK6yAZpJXHcqAhCkhzghnn",
    pkg: "featured",
    description: "Fictional demo application used to illustrate a rejected screening.",
    mcap: 980_000,
    liq: 22_000,
    holders: 640,
    top10: 61.3,
    scores: [2, 1, 3, 2, 2, 3, 3, 1],
    flags: ["Mint authority active", "LP not locked or burned", "Top 10 holders > 30%", "Bundled launch detected", "Suspected wash trading"],
    notes: "Rejected. Mint authority still active, LP unlocked, and launch shows bundled buys across 14 linked wallets. Fee does not influence outcome.",
    risk: "high",
    submitted: "2026-10-12T07:30:00Z",
    screened: "2026-10-13T17:05:00Z",
    applicationStatus: "rejected",
  },
];

const PENDING_APPLICATIONS: Omit<Application, "id" | "updatedAt" | "source" | "paymentStatus">[] = [
  {
    reference: "RUN-7Q4K2M",
    projectName: "Lumen Otter",
    ticker: "LOTR",
    contractAddress: "59c4Jtkt12JStD22Zf2cdLbvT26GHeEoQWesPL4Knaxi",
    website: "https://lumenotter.example",
    twitter: "https://x.com/lumenotter_demo",
    telegram: "https://t.me/lumenotter_demo",
    discord: "https://discord.gg/lumenotter-demo",
    description: "Glow-in-the-dark otter memecoin with a nightly art drop. Fictional demo application awaiting review.",
    applicantWallet: "C3bpVHLcvxnxLByNKZD21e7DW2hp5nuBBYaQ6CynU5zS",
    campaignPackage: "growth",
    status: "submitted",
    createdAt: "2026-10-29T13:12:00Z",
  },
  {
    reference: "RUN-3HX9TB",
    projectName: "GlassFrog",
    ticker: "GFROG",
    contractAddress: "DMof2Z8k1THxGDfFrw6Pqaqwe4eJneWw4rL3nHhnNESc",
    website: "https://glassfrog.example",
    twitter: "https://x.com/glassfrog_demo",
    telegram: "https://t.me/glassfrog_demo",
    discord: "",
    description: "Transparent frog themed token with a public treasury dashboard. Fictional demo application under review.",
    applicantWallet: "HJzXbDY5X8jp2yAVEiFpg2xgPTovc8YFJN8GE7rNpbzm",
    campaignPackage: "starter",
    status: "under_review",
    createdAt: "2026-10-27T10:05:00Z",
  },
  {
    reference: "RUN-8VN2PE",
    projectName: "Tundra Cat",
    ticker: "TCAT",
    contractAddress: "HbEForh95LJQxFHb8DnfrRwa9x6wCKB96f5ApVgcVafK",
    website: "https://tundracat.example",
    twitter: "https://x.com/tundracat_demo",
    telegram: "",
    discord: "https://discord.gg/tundracat-demo",
    description: "Snow-leopard-cat hybrid mascot memecoin. Fictional demo application awaiting review.",
    applicantWallet: "9nvnHm8SYgnJXbXH3SP4QtyADNprVLKmG84Gn4bxX6NQ",
    campaignPackage: "featured",
    status: "submitted",
    createdAt: "2026-10-31T22:40:00Z",
  },
];

function refFor(i: number): string {
  const refs = ["RUN-M8R2UN", "RUN-EX4MPL", "RUN-5PUP0K", "RUN-P1X3LS", "RUN-N0VA7R", "RUN-DR1FTW", "RUN-QF71PX"];
  return refs[i] ?? `RUN-DEMO${i}`;
}

function links(slug: string) {
  return {
    website: `https://${slug}.example`,
    twitter: `https://x.com/${slug}_demo`,
    telegram: `https://t.me/${slug}_demo`,
    discord: `https://discord.gg/${slug}-demo`,
  };
}

export interface DemoSeed {
  applications: Application[];
  screenings: Screening[];
  campaigns: Campaign[];
  purchases: TreasuryPurchase[];
  distributions: Distribution[];
}

/** Token amounts the simulated treasury "bought" for completed/active demo campaigns. */
const DEMO_PURCHASES: Record<string, { tokenAmount: string; executedAt: string; notes: string }> = {
  examplecoin: { tokenAmount: "1842105.263157", executedAt: "2026-09-14T18:00:00Z", notes: "Simulated purchase — illustrative price only." },
  novatrail: { tokenAmount: "905405.405405", executedAt: "2026-09-24T18:00:00Z", notes: "Simulated purchase — illustrative price only." },
  moonrunner: { tokenAmount: "2283105.022831", executedAt: "2026-10-30T18:00:00Z", notes: "Simulated purchase recorded ahead of snapshot." },
};

export function createDemoSeed(): DemoSeed {
  const applications: Application[] = [];
  const screenings: Screening[] = [];
  const campaigns: Campaign[] = [];
  const purchases: TreasuryPurchase[] = [];
  const distributions: Distribution[] = [];

  PROJECTS.forEach((p, i) => {
    const appId = `demo-app-${p.slug}`;
    applications.push({
      id: appId,
      reference: refFor(i),
      projectName: p.projectName,
      ticker: p.ticker,
      contractAddress: p.address,
      ...links(p.slug),
      description: p.description,
      applicantWallet: p.applicant,
      campaignPackage: p.pkg,
      status: p.applicationStatus,
      paymentStatus: "test_mode_simulated",
      createdAt: p.submitted,
      updatedAt: p.screened,
      source: "demo",
    });

    const [liq, hold, dev, com, trade, auth, tokenomics, manip] = p.scores;
    screenings.push({
      id: `demo-scr-${p.slug}`,
      applicationId: appId,
      liquidityScore: liq,
      holderDistributionScore: hold,
      developerActivityScore: dev,
      communityScore: com,
      tradingActivityScore: trade,
      tokenAuthoritiesScore: auth,
      tokenomicsScore: tokenomics,
      manipulationScore: manip,
      marketCapUsd: p.mcap,
      liquidityUsd: p.liq,
      holderCount: p.holders,
      top10HolderPct: p.top10,
      mintAuthorityRevoked: !p.flags.includes("Mint authority active"),
      freezeAuthorityRevoked: !p.flags.includes("Freeze authority active"),
      riskFlags: p.flags,
      screeningNotes: p.notes,
      recommendation: p.applicationStatus === "approved" ? "approve" : "reject",
      riskLevel: p.risk,
      reviewedBy: "RUNNER Screening (demo)",
      createdAt: p.screened,
    });

    if (!p.campaign) return;
    const alloc = calculateCampaignAllocation(CAMPAIGN_PACKAGES[p.pkg].feeUsdCents);
    const campaignId = `demo-cmp-${p.slug}`;
    campaigns.push({
      id: campaignId,
      slug: p.slug,
      applicationId: appId,
      projectName: p.projectName,
      ticker: p.ticker,
      tokenAddress: p.address,
      description: p.description,
      ...links(p.slug),
      campaignPackage: p.pkg,
      totalCampaignFeeCents: alloc.totalUsdCents,
      rewardAllocationCents: alloc.rewardUsdCents,
      operationsAllocationCents: alloc.operationsUsdCents,
      reserveAllocationCents: alloc.reserveUsdCents,
      status: p.campaign.status,
      featured: p.campaign.featured,
      riskLevel: p.risk,
      screeningDate: p.screened,
      marketCapAtScreeningUsd: p.mcap,
      liquidityAtScreeningUsd: p.liq,
      holderCountAtScreening: p.holders,
      snapshotAt: p.campaign.snapshotAt,
      eligibleSupply: p.campaign.status === "completed" ? String(DEMO_ELIGIBLE_SUPPLY) : null,
      createdAt: p.screened,
      updatedAt: p.screened,
      source: "demo",
    });

    const purchase = DEMO_PURCHASES[p.slug];
    if (purchase) {
      purchases.push({
        id: `demo-buy-${p.slug}`,
        campaignId,
        usdcSpentCents: alloc.rewardUsdCents,
        tokenAmount: purchase.tokenAmount,
        status: "simulated",
        transactionSignature: null,
        notes: purchase.notes,
        executedAt: purchase.executedAt,
        source: "demo",
      });
    }

    if (p.campaign.status === "completed" && purchase) {
      const pool = toBaseUnits(purchase.tokenAmount, REWARD_TOKEN_DECIMALS);
      const supply = BigInt(DEMO_ELIGIBLE_SUPPLY);
      const holders = [{ wallet: DEMO_WALLET, balance: DEMO_RUNNER_BALANCE }, ...OTHER_DEMO_HOLDERS];
      holders.forEach((h, j) => {
        const r = calculateHolderReward({ holderBalance: BigInt(h.balance), eligibleSupply: supply, rewardPool: pool });
        distributions.push({
          id: `demo-dist-${p.slug}-${j}`,
          campaignId,
          walletAddress: h.wallet,
          runnerBalance: String(h.balance),
          eligibleSupply: String(DEMO_ELIGIBLE_SUPPLY),
          rewardPercentage: r.percentage,
          rewardAmount: fromBaseUnits(r.rewardAmount, REWARD_TOKEN_DECIMALS),
          distributionStatus: "simulated",
          transactionSignature: null,
          createdAt: purchase.executedAt.replace("18:00", "20:00"),
          source: "demo",
        });
      });
    }
  });

  PENDING_APPLICATIONS.forEach((a, i) => {
    applications.push({
      ...a,
      id: `demo-app-pending-${i}`,
      paymentStatus: "test_mode_simulated",
      updatedAt: a.createdAt,
      source: "demo",
    });
  });

  return { applications, screenings, campaigns, purchases, distributions };
}
