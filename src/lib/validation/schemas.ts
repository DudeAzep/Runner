import { z } from "zod";
import { PACKAGE_IDS } from "@/lib/economics/allocation";
import { CAMPAIGN_STATUSES, RISK_LEVELS, type CampaignStatus, type RiskLevel } from "@/lib/types";
import { isValidSolanaAddress } from "./solana";

const solanaAddress = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(isValidSolanaAddress, `${label} must be a valid Solana address (base58, 32 bytes)`);

function hostIs(url: string, hosts: string[]): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return hosts.some((x) => h === x || h.endsWith(`.${x}`));
  } catch {
    return false;
  }
}

const httpsUrl = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(300)
    .url(`${label} must be a valid URL`)
    .refine((u) => u.startsWith("https://"), `${label} must use https://`);

export const applicationSchema = z.object({
  projectName: z.string().trim().min(2, "Project name must be at least 2 characters").max(60),
  ticker: z
    .string()
    .trim()
    .transform((t) => t.replace(/^\$/, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{2,10}$/, "Ticker must be 2–10 letters or numbers")),
  contractAddress: solanaAddress("Contract address"),
  website: httpsUrl("Website"),
  twitter: httpsUrl("X/Twitter URL").refine((u) => hostIs(u, ["x.com", "twitter.com"]), "Must be an x.com or twitter.com link"),
  telegram: httpsUrl("Telegram URL").refine((u) => hostIs(u, ["t.me", "telegram.me"]), "Must be a t.me link"),
  discord: httpsUrl("Discord URL").refine((u) => hostIs(u, ["discord.gg", "discord.com"]), "Must be a discord.gg or discord.com link"),
  description: z.string().trim().min(40, "Description must be at least 40 characters").max(2000),
  // The applicant's wallet isn't a form field: it comes from their wallet sign-in on the server.
  campaignPackage: z.enum(PACKAGE_IDS as [string, ...string[]], { message: "Select a campaign package" }),
  acceptTerms: z.literal(true, { message: "You must acknowledge the screening notice" }),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

const score = z.coerce.number().int().min(0).max(10);
const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().nonnegative().nullable(),
);
const optionalBool = z.preprocess((v) => (v === "yes" ? true : v === "no" ? false : null), z.boolean().nullable());

export const screeningSchema = z.object({
  liquidityScore: score,
  holderDistributionScore: score,
  developerActivityScore: score,
  communityScore: score,
  tradingActivityScore: score,
  tokenAuthoritiesScore: score,
  tokenomicsScore: score,
  manipulationScore: score,
  marketCapUsd: optionalNumber,
  liquidityUsd: optionalNumber,
  holderCount: optionalNumber,
  top10HolderPct: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).max(100).nullable(),
  ),
  mintAuthorityRevoked: optionalBool,
  freezeAuthorityRevoked: optionalBool,
  riskFlags: z.array(z.string().max(80)).max(20),
  screeningNotes: z.string().trim().max(5000),
  recommendation: z.enum(["approve", "reject", "needs_info"]),
  riskLevel: z.enum(RISK_LEVELS as [RiskLevel, ...RiskLevel[]]),
});

export type ScreeningInput = z.infer<typeof screeningSchema>;

export const campaignUpdateSchema = z.object({
  description: z.string().trim().min(10).max(2000),
  status: z.enum(CAMPAIGN_STATUSES as [CampaignStatus, ...CampaignStatus[]]),
  riskLevel: z.enum(RISK_LEVELS as [RiskLevel, ...RiskLevel[]]),
  featured: z.boolean(),
  snapshotAt: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date").nullable(),
  ),
});

export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;

export const purchaseSchema = z.object({
  usdcSpent: z.coerce.number().positive("Amount must be positive").max(1_000_000),
  tokenAmount: z.string().trim().regex(/^\d+(\.\d{1,9})?$/, "Token amount must be a positive decimal"),
  notes: z.string().trim().max(500).default(""),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;

/**
 * Parses a holder snapshot CSV: one "wallet,balance" per line (header optional).
 * Balances are whole RUNNER tokens or decimals; they are converted to base units.
 */
export function parseSnapshotCsv(text: string, decimals: number): { holders: { wallet: string; balance: string }[]; errors: string[] } {
  const errors: string[] = [];
  const byWallet = new Map<string, bigint>();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const [walletRaw, balRaw] = line.split(/[,;\t]/).map((x) => x?.trim().replace(/^"|"$/g, "") ?? "");
    if (i === 0 && walletRaw && !isValidSolanaAddress(walletRaw) && !/^\d/.test(balRaw ?? "")) return; // header
    if (!walletRaw || !isValidSolanaAddress(walletRaw)) return void errors.push(`Line ${i + 1}: invalid wallet address`);
    const bal = (balRaw ?? "").replace(/[_\s]/g, "").replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(bal)) return void errors.push(`Line ${i + 1}: invalid balance`);
    const [w, f = ""] = bal.split(".");
    const raw = BigInt(w!) * 10n ** BigInt(decimals) + BigInt((f + "0".repeat(decimals)).slice(0, decimals) || "0");
    byWallet.set(walletRaw, (byWallet.get(walletRaw) ?? 0n) + raw);
  });
  return { holders: [...byWallet].map(([wallet, b]) => ({ wallet, balance: b.toString() })), errors: errors.slice(0, 20) };
}

export const referenceSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^RUN-[A-Z0-9]{6}$/, "Reference numbers look like RUN-XXXXXX");
