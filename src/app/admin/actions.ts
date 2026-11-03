"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/admin";
import { getConfig } from "@/lib/config";
import { getRepository } from "@/lib/data";
import { RepositoryError } from "@/lib/data/repository";
import { fromBaseUnits, toBaseUnits } from "@/lib/economics/rewards";
import {
  buildRewardBatch,
  buildTreasurySwap,
  decodeSigned,
  fetchAllHolders,
  fetchParsedTx,
  fetchTokenReport,
  getMintInfo,
  rpcHealth,
  SolanaError,
  submitAndConfirm,
} from "@/lib/solana/server";
import { verifySwap, verifyTransfers } from "@/lib/solana/verify";
import { APPLICATION_STATUSES, CAMPAIGN_STATUSES, type ApplicationStatus, type CampaignStatus } from "@/lib/types";
import { campaignUpdateSchema, parseSnapshotCsv, purchaseSchema, screeningSchema } from "@/lib/validation/schemas";

/**
 * Every admin mutation goes through `guard`, which performs server-side
 * authorization BEFORE any input is parsed or any data is touched.
 */
export interface ActionResult<T = undefined> {
  ok: boolean;
  message: string;
  at: number;
  data?: T;
}

class ValidationFailure extends Error {}

async function guard<T = undefined>(handler: () => Promise<string | { message: string; data: T }>): Promise<ActionResult<T>> {
  try {
    await requireAdmin();
    const r = await handler();
    return typeof r === "string" ? { ok: true, message: r, at: Date.now() } : { ok: true, message: r.message, data: r.data, at: Date.now() };
  } catch (err) {
    const at = Date.now();
    if (err instanceof UnauthorizedError) return { ok: false, message: "Your admin session has expired. Please sign in again.", at };
    if (err instanceof RepositoryError || err instanceof ValidationFailure || err instanceof SolanaError) return { ok: false, message: err.message, at };
    console.error("admin action failed", err);
    return { ok: false, message: "Unexpected error. Nothing was changed.", at };
  }
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

function checkId(id: string): string {
  if (!/^[A-Za-z0-9-]{1,80}$/.test(id)) throw new ValidationFailure("Invalid record id.");
  return id;
}

/** <input type="datetime-local"> has no zone; the admin UI labels it UTC. */
function parseUtcInput(raw: string): string | null {
  if (!raw) return null;
  const withZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00Z` : raw;
  const t = Date.parse(withZone);
  if (Number.isNaN(t)) throw new ValidationFailure("Invalid snapshot date.");
  return new Date(t).toISOString();
}

function refresh() {
  revalidatePath("/", "layout");
}

function requireLiveTreasury() {
  const cfg = getConfig();
  if (!cfg.treasuryLive || !cfg.treasuryWallet) throw new ValidationFailure("Live treasury is not enabled. Set TREASURY_WALLET and TREASURY_MODE=live in .env.local.");
  return cfg as typeof cfg & { treasuryWallet: string };
}

/* ------------------------------- Screening ------------------------------- */

export async function saveScreeningAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const admin = await requireAdmin();
    const applicationId = checkId(str(fd, "applicationId"));
    const parsed = screeningSchema.safeParse({
      liquidityScore: str(fd, "liquidityScore"),
      holderDistributionScore: str(fd, "holderDistributionScore"),
      developerActivityScore: str(fd, "developerActivityScore"),
      communityScore: str(fd, "communityScore"),
      tradingActivityScore: str(fd, "tradingActivityScore"),
      tokenAuthoritiesScore: str(fd, "tokenAuthoritiesScore"),
      tokenomicsScore: str(fd, "tokenomicsScore"),
      manipulationScore: str(fd, "manipulationScore"),
      marketCapUsd: str(fd, "marketCapUsd"),
      liquidityUsd: str(fd, "liquidityUsd"),
      holderCount: str(fd, "holderCount"),
      top10HolderPct: str(fd, "top10HolderPct"),
      mintAuthorityRevoked: str(fd, "mintAuthorityRevoked"),
      freezeAuthorityRevoked: str(fd, "freezeAuthorityRevoked"),
      riskFlags: fd.getAll("riskFlags").map(String),
      screeningNotes: str(fd, "screeningNotes"),
      recommendation: str(fd, "recommendation"),
      riskLevel: str(fd, "riskLevel"),
    });
    if (!parsed.success) throw new ValidationFailure(`Invalid screening: ${parsed.error.issues[0]?.path.join(".")} — ${parsed.error.issues[0]?.message}`);
    getRepository().saveScreening(applicationId, parsed.data, admin.label);
    refresh();
    return "Screening report saved.";
  });
}

export async function fetchTokenReportAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const applicationId = checkId(str(fd, "applicationId"));
    const repo = getRepository();
    const detail = repo.getApplicationDetail(applicationId);
    if (!detail) throw new RepositoryError("Application not found", "not_found");
    const report = await fetchTokenReport(applicationId, detail.application.contractAddress);
    repo.saveTokenReport(report);
    refresh();
    return report.errors.length ? `Fetched with ${report.errors.length} warning(s): ${report.errors[0]}` : "On-chain and market data fetched.";
  });
}

/* ------------------------------ Applications ----------------------------- */

export async function setApplicationStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = checkId(str(fd, "id"));
    const status = str(fd, "status") as ApplicationStatus;
    if (!APPLICATION_STATUSES.includes(status)) throw new ValidationFailure("Invalid status.");
    getRepository().setApplicationStatus(id, status);
    refresh();
    return status === "approved" ? "Application approved." : status === "rejected" ? "Application rejected." : "Status updated.";
  });
}

export async function createCampaignAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const applicationId = checkId(str(fd, "applicationId"));
    const status = (str(fd, "status") || "upcoming") as CampaignStatus;
    if (!["upcoming", "active"].includes(status)) throw new ValidationFailure("New campaigns start as Upcoming or Live.");
    const c = getRepository().createCampaignFromApplication(applicationId, {
      status,
      featured: fd.get("featured") === "on",
      snapshotAt: parseUtcInput(str(fd, "snapshotAt")),
    });
    refresh();
    return `Campaign created: /campaigns/${c.slug}`;
  });
}

/* ------------------------------- Campaigns ------------------------------- */

export async function updateCampaignAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = checkId(str(fd, "id"));
    const parsed = campaignUpdateSchema.safeParse({
      description: str(fd, "description"),
      status: str(fd, "status"),
      riskLevel: str(fd, "riskLevel"),
      featured: fd.get("featured") === "on",
      snapshotAt: parseUtcInput(str(fd, "snapshotAt")) ?? "",
    });
    if (!parsed.success) throw new ValidationFailure(`${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`);
    getRepository().updateCampaign(id, parsed.data);
    refresh();
    return "Campaign updated.";
  });
}

export async function setCampaignStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = checkId(str(fd, "id"));
    const status = str(fd, "status") as CampaignStatus;
    if (!CAMPAIGN_STATUSES.includes(status)) throw new ValidationFailure("Invalid status.");
    const repo = getRepository();
    const current = repo.getCampaignById(id);
    if (!current) throw new RepositoryError("Campaign not found", "not_found");
    const c = current.campaign;
    repo.updateCampaign(id, { description: c.description, status, riskLevel: c.riskLevel, featured: c.featured, snapshotAt: c.snapshotAt });
    refresh();
    return `Campaign status set to ${status}.`;
  });
}

/* --------------------------- Treasury purchases --------------------------- */

export async function recordSimulatedPurchaseAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    if (getConfig().treasuryLive) throw new ValidationFailure("Live treasury mode is on — record real purchases with Jupiter or a transaction signature.");
    const id = checkId(str(fd, "campaignId"));
    const parsed = purchaseSchema.safeParse({ usdcSpent: str(fd, "usdcSpent"), tokenAmount: str(fd, "tokenAmount"), notes: str(fd, "notes") });
    if (!parsed.success) throw new ValidationFailure(parsed.error.issues[0]?.message ?? "Invalid purchase");
    getRepository().recordPurchase(id, {
      usdcSpentCents: Math.round(parsed.data.usdcSpent * 100),
      tokenAmount: parsed.data.tokenAmount,
      notes: parsed.data.notes,
      signature: null,
      rewardDecimals: null,
    });
    refresh();
    return "Simulated treasury purchase recorded.";
  });
}

export interface SwapPreview {
  transaction: string;
  lastValidBlockHeight: number;
  usdcIn: string;
  tokensOut: string;
  minTokensOut: string;
  priceImpactPct: string;
  route: string;
}

/** Step 1 of a live purchase: Jupiter quote + unsigned swap transaction for the treasury wallet to sign. */
export async function prepareSwapAction(campaignId: string, usdcAmount: string): Promise<ActionResult<SwapPreview>> {
  return guard(async () => {
    const cfg = requireLiveTreasury();
    const detail = getRepository().getCampaignById(checkId(campaignId));
    if (!detail) throw new RepositoryError("Campaign not found", "not_found");
    if (!/^\d+(\.\d{1,6})?$/.test(usdcAmount.trim())) throw new ValidationFailure("Enter a USDC amount like 700 or 349.50.");
    const usdcRaw = toBaseUnits(usdcAmount.trim(), 6);
    const cents = Number(usdcRaw / 10_000n);
    const spent = detail.purchases.reduce((s, p) => s + p.usdcSpentCents, 0);
    if (usdcRaw <= 0n) throw new ValidationFailure("Amount must be positive.");
    if (spent + cents > detail.campaign.rewardAllocationCents) throw new ValidationFailure("That exceeds the remaining reward allocation.");
    const mint = await getMintInfo(detail.campaign.tokenAddress);
    const swap = await buildTreasurySwap({ outputMint: detail.campaign.tokenAddress, usdcRaw });
    void cfg;
    return {
      message: "Quote ready. Review and sign with the treasury wallet.",
      data: {
        transaction: swap.transaction,
        lastValidBlockHeight: swap.lastValidBlockHeight,
        usdcIn: fromBaseUnits(BigInt(swap.quote.inAmount), 6),
        tokensOut: fromBaseUnits(BigInt(swap.quote.outAmount), mint.decimals, 4),
        minTokensOut: fromBaseUnits(BigInt(swap.quote.otherAmountThreshold), mint.decimals, 4),
        priceImpactPct: swap.quote.priceImpactPct,
        route: swap.quote.routeLabels.join(" → "),
      },
    };
  });
}

function recordVerifiedSwap(campaignId: string, signature: string, parsed: Awaited<ReturnType<typeof fetchParsedTx>>, notes: string) {
  const cfg = requireLiveTreasury();
  const repo = getRepository();
  const detail = repo.getCampaignById(campaignId);
  if (!detail) throw new RepositoryError("Campaign not found", "not_found");
  const v = verifySwap(parsed, { treasury: cfg.treasuryWallet, inputMint: cfg.usdcMint, outputMint: detail.campaign.tokenAddress });
  if (!v.ok || v.outputDecimals == null) throw new ValidationFailure(`Swap not verified: ${v.errors.join(" ")}`);
  const cents = Number((v.inputSpentRaw + 5_000n) / 10_000n); // round to nearest cent
  repo.recordPurchase(campaignId, {
    usdcSpentCents: cents,
    tokenAmount: fromBaseUnits(v.outputReceivedRaw, v.outputDecimals),
    notes,
    signature,
    rewardDecimals: v.outputDecimals,
  });
  return `Purchase confirmed on-chain: ${fromBaseUnits(v.outputReceivedRaw, v.outputDecimals, 4)} ${detail.campaign.ticker} for $${(cents / 100).toFixed(2)}.`;
}

/** Step 2: broadcast the treasury-signed swap, confirm it, verify balances, record it. */
export async function executeSwapAction(campaignId: string, signedTx: string, lastValidBlockHeight: number): Promise<ActionResult> {
  return guard(async () => {
    const cfg = requireLiveTreasury();
    const { feePayer, tx } = decodeSigned(signedTx);
    if (feePayer !== cfg.treasuryWallet) throw new ValidationFailure("This transaction must be signed by the treasury wallet.");
    const { signature, parsed } = await submitAndConfirm(signedTx, { blockhash: tx.message.recentBlockhash, lastValidBlockHeight });
    const msg = recordVerifiedSwap(checkId(campaignId), signature, parsed, "Jupiter swap via RUNNER admin");
    refresh();
    return msg;
  });
}

/** Record a swap the treasury already made elsewhere (e.g. jup.ag) by its signature. */
export async function verifyPurchaseSignatureAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const campaignId = checkId(str(fd, "campaignId"));
    const signature = str(fd, "signature").trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) throw new ValidationFailure("That doesn't look like a Solana transaction signature.");
    const parsed = await fetchParsedTx(signature);
    const msg = recordVerifiedSwap(campaignId, signature, parsed, "Verified external swap");
    refresh();
    return msg;
  });
}

/* -------------------------------- Snapshots -------------------------------- */

export async function snapshotFromChainAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const cfg = getConfig();
    if (!cfg.runnerMint) throw new ValidationFailure("RUNNER_MINT is not set in .env.local. Upload a CSV instead.");
    const campaignId = checkId(str(fd, "campaignId"));
    const { holders, decimals, slot } = await fetchAllHolders(cfg.runnerMint);
    const s = getRepository().saveSnapshot(campaignId, { method: "rpc", runnerMint: cfg.runnerMint, slot, runnerDecimals: decimals, holders, excludedWallets: cfg.excludedWallets });
    refresh();
    return `Snapshot taken at slot ${slot}: ${s.holderCount} eligible holders.`;
  });
}

export async function snapshotFromCsvAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const cfg = getConfig();
    const campaignId = checkId(str(fd, "campaignId"));
    const file = fd.get("csv");
    let text = str(fd, "csvText");
    if (file instanceof File && file.size > 0) {
      if (file.size > 20_000_000) throw new ValidationFailure("CSV is larger than 20 MB.");
      text = await file.text();
    }
    if (!text.trim()) throw new ValidationFailure("Choose a CSV file or paste rows (wallet,balance).");
    const decimals = Number(str(fd, "decimals") || "0");
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 12) throw new ValidationFailure("Decimals must be 0–12.");
    const { holders, errors } = parseSnapshotCsv(text, decimals);
    if (errors.length) throw new ValidationFailure(`CSV problems: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "…" : ""}`);
    const s = getRepository().saveSnapshot(campaignId, { method: "csv", runnerMint: cfg.runnerMint, slot: null, runnerDecimals: decimals, holders, excludedWallets: cfg.excludedWallets });
    refresh();
    return `Snapshot imported: ${s.holderCount} eligible holders.`;
  });
}

/* ------------------------------ Distributions ------------------------------ */

export async function planDistributionAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const campaignId = checkId(str(fd, "campaignId"));
    const r = getRepository().planDistribution(campaignId, { liveOnly: getConfig().treasuryLive });
    refresh();
    return `Plan ready: ${r.planned} recipients${r.skipped ? `, ${r.skipped} below minimum` : ""}. Undistributed dust: ${r.undistributed}.`;
  });
}

export async function simulateDistributionAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    if (getConfig().treasuryLive) throw new ValidationFailure("Live treasury mode is on — send real batches instead.");
    const n = getRepository().simulateAll(checkId(str(fd, "campaignId")));
    refresh();
    return `${n} distributions marked as SIMULATED (no tokens sent).`;
  });
}

export interface PreparedBatch {
  transaction: string;
  blockhash: string;
  lastValidBlockHeight: number;
  ids: string[];
  recipients: number;
}

/** Builds the next batch of reward transfers for the treasury wallet to sign. */
export async function prepareDistributionBatchAction(campaignId: string): Promise<ActionResult<PreparedBatch>> {
  return guard(async () => {
    const cfg = requireLiveTreasury();
    const repo = getRepository();
    const detail = repo.getCampaignById(checkId(campaignId));
    if (!detail) throw new RepositoryError("Campaign not found", "not_found");
    if (repo.submittedSignatures(campaignId).length) throw new ValidationFailure("A previous batch is still unconfirmed. Click “Check pending” first.");
    const batch = repo.nextBatch(campaignId, cfg.distributionBatchSize);
    if (!batch.length) throw new ValidationFailure("No pending recipients.");
    const built = await buildRewardBatch({
      mint: detail.campaign.tokenAddress,
      transfers: batch.map((d) => ({ owner: d.walletAddress, amountRaw: BigInt(d.rewardAmountRaw) })),
    });
    if (built.decimals !== batch[0]!.rewardDecimals) throw new ValidationFailure("Reward token decimals changed since planning. Rebuild the plan.");
    return {
      message: `Batch of ${batch.length} ready to sign.`,
      data: { transaction: built.transaction, blockhash: built.blockhash, lastValidBlockHeight: built.lastValidBlockHeight, ids: batch.map((d) => d.id), recipients: batch.length },
    };
  });
}

/** Records the batch as submitted (before broadcasting), sends it, then confirms each recipient on-chain. */
export async function submitDistributionBatchAction(campaignId: string, ids: string[], signedTx: string, blockhash: string, lastValidBlockHeight: number): Promise<ActionResult> {
  return guard(async () => {
    const cfg = requireLiveTreasury();
    const repo = getRepository();
    const detail = repo.getCampaignById(checkId(campaignId));
    if (!detail) throw new RepositoryError("Campaign not found", "not_found");
    const { feePayer, signature } = decodeSigned(signedTx);
    if (feePayer !== cfg.treasuryWallet) throw new ValidationFailure("This batch must be signed by the treasury wallet.");
    const rows = repo.listDistributions(campaignId).filter((d) => ids.includes(d.id));
    if (rows.length !== ids.length) throw new ValidationFailure("Batch no longer matches the plan. Refresh and try again.");

    repo.markSubmitted(ids, signature); // persisted BEFORE broadcast → never double-paid
    let parsed;
    try {
      parsed = (await submitAndConfirm(signedTx, { blockhash, lastValidBlockHeight })).parsed;
    } catch (e) {
      // The send may or may not have landed; leave as "submitted" for reconciliation.
      refresh();
      throw e;
    }
    const v = verifyTransfers(parsed, {
      treasury: cfg.treasuryWallet,
      mint: detail.campaign.tokenAddress,
      transfers: rows.map((r) => ({ owner: r.walletAddress, amountRaw: BigInt(r.rewardAmountRaw) })),
    });
    const landed = Boolean(parsed && !parsed.meta?.err);
    const r = repo.settleSubmitted(signature, v.confirmedOwners, landed);
    refresh();
    if (!v.ok) throw new ValidationFailure(`Batch verification issues: ${v.errors.slice(0, 2).join(" ")} (${r.confirmed} confirmed, ${r.reverted} returned to pending)`);
    return `Batch confirmed on-chain: ${r.confirmed} recipients paid.`;
  });
}

/** Resolves batches left in "submitted" (e.g. the browser closed mid-send). */
export async function reconcileDistributionsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const cfg = requireLiveTreasury();
    const campaignId = checkId(str(fd, "campaignId"));
    const repo = getRepository();
    const detail = repo.getCampaignById(campaignId);
    if (!detail) throw new RepositoryError("Campaign not found", "not_found");
    let confirmed = 0;
    let reverted = 0;
    let waiting = 0;
    for (const sig of repo.submittedSignatures(campaignId)) {
      const rows = repo.listDistributions(campaignId).filter((d) => d.transactionSignature === sig);
      const parsed = await fetchParsedTx(sig);
      if (!parsed) {
        // Not found: only safe to retry once the blockhash has certainly expired (~2 minutes).
        const age = Date.now() - Math.max(...rows.map((r) => Date.parse(r.updatedAt)));
        if (age > 150_000) reverted += repo.settleSubmitted(sig, [], false).reverted;
        else waiting++;
        continue;
      }
      const v = verifyTransfers(parsed, {
        treasury: cfg.treasuryWallet,
        mint: detail.campaign.tokenAddress,
        transfers: rows.map((r) => ({ owner: r.walletAddress, amountRaw: BigInt(r.rewardAmountRaw) })),
      });
      const r = repo.settleSubmitted(sig, v.confirmedOwners, !parsed.meta?.err);
      confirmed += r.confirmed;
      reverted += r.reverted;
    }
    refresh();
    return `Reconciled: ${confirmed} confirmed, ${reverted} returned to pending${waiting ? `, ${waiting} batch(es) still settling — check again in 2 minutes` : ""}.`;
  });
}

/* ---------------------------------- Admin ---------------------------------- */

export async function removeDemoDataAction(_prev: ActionResult | null, _fd: FormData): Promise<ActionResult> {
  void _fd;
  return guard(async () => {
    const n = getRepository().removeDemoData();
    refresh();
    return `Removed ${n} demo records. Only real data remains.`;
  });
}

export async function checkRpcAction(_prev: ActionResult | null, _fd: FormData): Promise<ActionResult> {
  void _fd;
  return guard(async () => {
    const h = await rpcHealth();
    if (!h.ok) throw new ValidationFailure(h.error ?? "RPC unreachable");
    return `RPC is reachable (slot ${h.slot}).`;
  });
}
