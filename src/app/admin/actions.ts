"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/admin";
import { getRepository } from "@/lib/data";
import { RepositoryError } from "@/lib/data/repository";
import { APPLICATION_STATUSES, CAMPAIGN_STATUSES, type ApplicationStatus, type CampaignStatus } from "@/lib/types";
import { campaignUpdateSchema, distributionSchema, purchaseSchema, screeningSchema } from "@/lib/validation/schemas";

/**
 * Every admin mutation goes through `guard`, which performs server-side
 * authorization BEFORE any input is parsed or any data is touched.
 */
export interface ActionResult {
  ok: boolean;
  message: string;
  at: number;
}

type Handler = (formData: FormData) => Promise<string>;

async function guard(handler: Handler, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const message = await handler(formData);
    return { ok: true, message, at: Date.now() };
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, message: "Your admin session has expired. Please sign in again.", at: Date.now() };
    if (err instanceof RepositoryError) return { ok: false, message: err.message, at: Date.now() };
    if (err instanceof ValidationFailure) return { ok: false, message: err.message, at: Date.now() };
    console.error("admin action failed", err);
    return { ok: false, message: "Unexpected error. Nothing was changed.", at: Date.now() };
  }
}

class ValidationFailure extends Error {}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

function requireId(fd: FormData, key = "id"): string {
  const id = str(fd, key);
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

/* ------------------------------- Screening ------------------------------- */

export async function saveScreeningAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const admin = await requireAdmin();
    const applicationId = requireId(fd, "applicationId");
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
    await getRepository().saveScreening(applicationId, parsed.data, `${admin.label}`);
    refresh();
    return "Screening report saved.";
  }, fd);
}

/* ------------------------------ Applications ----------------------------- */

export async function setApplicationStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = requireId(fd);
    const status = str(fd, "status") as ApplicationStatus;
    if (!APPLICATION_STATUSES.includes(status)) throw new ValidationFailure("Invalid status.");
    await getRepository().setApplicationStatus(id, status);
    refresh();
    return status === "approved" ? "Application approved." : status === "rejected" ? "Application rejected." : "Status updated.";
  }, fd);
}

export async function createCampaignAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const applicationId = requireId(fd, "applicationId");
    const status = (str(fd, "status") || "upcoming") as CampaignStatus;
    if (!["upcoming", "active"].includes(status)) throw new ValidationFailure("New campaigns start as Upcoming or Live.");
    const snapshotAt = parseUtcInput(str(fd, "snapshotAt"));
    const c = await getRepository().createCampaignFromApplication(applicationId, { status, featured: fd.get("featured") === "on", snapshotAt });
    refresh();
    return `Campaign created: /campaigns/${c.slug}`;
  }, fd);
}

/* ------------------------------- Campaigns ------------------------------- */

export async function updateCampaignAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = requireId(fd);
    const snapshotAt = parseUtcInput(str(fd, "snapshotAt"));
    const parsed = campaignUpdateSchema.safeParse({
      description: str(fd, "description"),
      status: str(fd, "status"),
      riskLevel: str(fd, "riskLevel"),
      featured: fd.get("featured") === "on",
      snapshotAt: snapshotAt ?? "",
      eligibleSupply: str(fd, "eligibleSupply").replace(/[,_\s]/g, ""),
    });
    if (!parsed.success) throw new ValidationFailure(`${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`);
    await getRepository().updateCampaign(id, parsed.data);
    refresh();
    return "Campaign updated.";
  }, fd);
}

export async function setCampaignStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = requireId(fd);
    const status = str(fd, "status") as CampaignStatus;
    if (!CAMPAIGN_STATUSES.includes(status)) throw new ValidationFailure("Invalid status.");
    const repo = getRepository();
    const current = await repo.getCampaignById(id);
    if (!current) throw new RepositoryError("Campaign not found", "not_found");
    const c = current.campaign;
    await repo.updateCampaign(id, {
      description: c.description,
      status,
      riskLevel: c.riskLevel,
      featured: c.featured,
      snapshotAt: c.snapshotAt,
      eligibleSupply: c.eligibleSupply,
    });
    refresh();
    return `Campaign status set to ${status}.`;
  }, fd);
}

export async function recordPurchaseAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = requireId(fd, "campaignId");
    const parsed = purchaseSchema.safeParse({ usdcSpent: str(fd, "usdcSpent"), tokenAmount: str(fd, "tokenAmount"), notes: str(fd, "notes") });
    if (!parsed.success) throw new ValidationFailure(parsed.error.issues[0]?.message ?? "Invalid purchase");
    const cents = Math.round(parsed.data.usdcSpent * 100);
    await getRepository().recordPurchase(id, { usdcSpentCents: cents, tokenAmount: parsed.data.tokenAmount, notes: parsed.data.notes });
    refresh();
    return "Simulated treasury purchase recorded.";
  }, fd);
}

export async function recordDistributionAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = requireId(fd, "campaignId");
    const parsed = distributionSchema.safeParse({
      walletAddress: str(fd, "walletAddress"),
      runnerBalance: str(fd, "runnerBalance").replace(/[,_\s]/g, ""),
    });
    if (!parsed.success) throw new ValidationFailure(parsed.error.issues[0]?.message ?? "Invalid distribution");
    const d = await getRepository().recordDistribution(id, parsed.data);
    refresh();
    return `Simulated distribution recorded: ${d.rewardAmount} tokens (${d.rewardPercentage}% of pool).`;
  }, fd);
}
