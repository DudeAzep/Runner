"use server";

import { headers } from "next/headers";
import { getWalletSession } from "@/lib/auth/wallet";
import { getConfig } from "@/lib/config";
import { getRepository } from "@/lib/data";
import { RepositoryError } from "@/lib/data/repository";
import { CAMPAIGN_PACKAGES } from "@/lib/economics/allocation";
import { buildUsdcPayment, decodeSigned, fetchParsedTx, SolanaError, submitAndConfirm } from "@/lib/solana/server";
import { paymentMemo, verifyUsdcPayment } from "@/lib/solana/verify";
import type { CampaignPackageId, PaymentStatus } from "@/lib/types";
import { applicationSchema, referenceSchema } from "@/lib/validation/schemas";
import { isValidSolanaAddress } from "@/lib/validation/solana";

export type SubmitState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string>; values: Record<string, string> }
  | {
      status: "success";
      reference: string;
      projectName: string;
      ticker: string;
      campaignPackage: CampaignPackageId;
      createdAt: string;
      paymentStatus: PaymentStatus;
    };

const FIELDS = ["projectName", "ticker", "contractAddress", "website", "twitter", "telegram", "discord", "description", "campaignPackage"] as const;

// Basic in-memory throttle per process to slow down scripted spam.
const recent = new Map<string, number[]>();
function throttled(key: string, limit = 5, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  recent.set(key, hits);
  return hits.length > limit;
}

async function ipKey() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

export async function submitApplication(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const values: Record<string, string> = {};
  for (const f of FIELDS) values[f] = String(formData.get(f) ?? "");

  // The applicant is whoever signed in with their wallet. No payment is taken now: the fee is requested after approval.
  const applicantWallet = await getWalletSession();
  if (!applicantWallet) {
    return { status: "error", message: "Sign in with your Solana wallet before submitting.", fieldErrors: {}, values };
  }

  const parsed = applicationSchema.safeParse({ ...values, acceptTerms: formData.get("acceptTerms") === "on" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, values };
  }

  if (throttled(`w:${applicantWallet}`) || throttled(`ip:${await ipKey()}`, 20)) {
    return { status: "error", message: "Too many submissions. Please try again later.", fieldErrors: {}, values };
  }

  try {
    const { acceptTerms: _accepted, ...input } = parsed.data;
    void _accepted;
    const app = getRepository().createApplication({ ...input, applicantWallet, campaignPackage: input.campaignPackage as CampaignPackageId });
    return {
      status: "success",
      reference: app.reference,
      projectName: app.projectName,
      ticker: app.ticker,
      campaignPackage: app.campaignPackage,
      createdAt: app.createdAt,
      paymentStatus: app.paymentStatus,
    };
  } catch (err) {
    const message = err instanceof RepositoryError ? err.message : "Something went wrong saving your application. Please retry.";
    if (!(err instanceof RepositoryError)) console.error("submitApplication failed", err);
    return { status: "error", message, fieldErrors: {}, values };
  }
}

/* --------------------------------- Payments -------------------------------- */

export interface PaymentResult<T = undefined> {
  ok: boolean;
  message: string;
  data?: T;
}

function awaitingApp(reference: string) {
  const ref = referenceSchema.safeParse(reference);
  if (!ref.success) throw new RepositoryError("Invalid reference number.", "invalid_state");
  const app = getRepository().getApplicationByReference(ref.data);
  if (!app) throw new RepositoryError("Application not found.", "not_found");
  return app;
}

function fail(e: unknown): PaymentResult<never> {
  if (e instanceof RepositoryError || e instanceof SolanaError) return { ok: false, message: e.message };
  console.error("payment error", e);
  return { ok: false, message: "Unexpected error. No payment was recorded." };
}

/** Builds the USDC transfer (with reference memo) for the applicant's wallet to sign. */
export async function preparePayment(reference: string, payer: string): Promise<PaymentResult<{ transaction: string; blockhash: string; lastValidBlockHeight: number; amount: string }>> {
  try {
    if (!getConfig().paymentsLive) return { ok: false, message: "Payments are in TEST MODE." };
    if (!isValidSolanaAddress(payer)) return { ok: false, message: "Connect a valid Solana wallet." };
    if (throttled(`pay:${await ipKey()}`, 30, 10 * 60_000)) return { ok: false, message: "Too many attempts. Wait a few minutes." };
    const app = awaitingApp(reference);
    if (app.paymentStatus === "paid") return { ok: false, message: "This application is already paid." };
    if (app.status !== "approved") return { ok: false, message: "The fee can only be paid after your application is approved." };
    const fee = CAMPAIGN_PACKAGES[app.campaignPackage].feeUsdCents;
    const tx = await buildUsdcPayment({ payer, amountRaw: BigInt(fee) * 10_000n, memo: paymentMemo(app.reference) });
    return { ok: true, message: "Approve the payment in your wallet.", data: { ...tx, amount: (fee / 100).toFixed(2) } };
  } catch (e) {
    return fail(e);
  }
}

function settle(reference: string, signature: string, parsed: Awaited<ReturnType<typeof fetchParsedTx>>): PaymentResult {
  const cfg = getConfig();
  const app = awaitingApp(reference);
  const fee = CAMPAIGN_PACKAGES[app.campaignPackage].feeUsdCents;
  const v = verifyUsdcPayment(parsed, { treasury: cfg.treasuryWallet!, usdcMint: cfg.usdcMint, amountRaw: BigInt(fee) * 10_000n, reference: app.reference });
  if (!v.ok) return { ok: false, message: `Payment not verified: ${v.errors.join(" ")}` };
  getRepository().markApplicationPaid(app.reference, { signature, payer: v.payer });
  return { ok: true, message: "Payment confirmed on-chain. Your application is in the screening queue." };
}

/** Broadcasts the wallet-signed payment, waits for confirmation, and verifies it on-chain. */
export async function submitPayment(reference: string, signedTx: string, blockhash: string, lastValidBlockHeight: number): Promise<PaymentResult> {
  try {
    if (!getConfig().paymentsLive) return { ok: false, message: "Payments are in TEST MODE." };
    const app = awaitingApp(reference);
    if (app.paymentStatus === "paid") return { ok: true, message: "Already paid." };
    if (app.status !== "approved") return { ok: false, message: "The fee can only be paid after your application is approved." };
    const { tx } = decodeSigned(signedTx);
    // Only relay transactions that carry this application's memo.
    const memoBytes = Buffer.from(paymentMemo(app.reference), "utf8");
    const keys = tx.message.staticAccountKeys.map((k) => k.toBase58());
    const hasMemo = tx.message.compiledInstructions.some(
      (ix) => keys[ix.programIdIndex] === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr" && Buffer.from(ix.data).equals(memoBytes),
    );
    if (!hasMemo) return { ok: false, message: "This transaction is not a RUNNER payment for this application." };
    const { signature, parsed } = await submitAndConfirm(signedTx, { blockhash, lastValidBlockHeight });
    return settle(app.reference, signature, parsed);
  } catch (e) {
    return fail(e);
  }
}

/** Verifies a payment that was already sent (e.g. the page was closed before confirmation). */
export async function verifyPaymentSignature(reference: string, signature: string): Promise<PaymentResult> {
  try {
    if (!getConfig().paymentsLive) return { ok: false, message: "Payments are in TEST MODE." };
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature.trim())) return { ok: false, message: "That doesn't look like a transaction signature." };
    const app = awaitingApp(reference);
    if (app.paymentStatus === "paid") return { ok: true, message: "Already paid." };
    return settle(app.reference, signature.trim(), await fetchParsedTx(signature.trim()));
  } catch (e) {
    return fail(e);
  }
}

/**
 * TEST MODE stand-in for paying the fee after approval. Only the signed-in
 * wallet that submitted the application can do this. No funds move.
 */
export async function simulateFeePayment(reference: string): Promise<PaymentResult> {
  try {
    if (getConfig().paymentsLive) return { ok: false, message: "Payments are live. Pay with your wallet instead." };
    const wallet = await getWalletSession();
    if (!wallet) return { ok: false, message: "Sign in with your wallet first." };
    const app = awaitingApp(reference);
    if (app.applicantWallet !== wallet) return { ok: false, message: "This application belongs to a different wallet." };
    getRepository().markApplicationTestPaid(app.reference);
    return { ok: true, message: "TEST MODE payment recorded. No funds moved." };
  } catch (e) {
    return fail(e);
  }
}
