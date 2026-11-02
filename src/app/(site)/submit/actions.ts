"use server";

import { getRepository } from "@/lib/data";
import { RepositoryError } from "@/lib/data/repository";
import type { CampaignPackageId } from "@/lib/types";
import { applicationSchema } from "@/lib/validation/schemas";

export type SubmitState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string>; values: Record<string, string> }
  | { status: "success"; reference: string; projectName: string; ticker: string; campaignPackage: CampaignPackageId; createdAt: string };

const FIELDS = [
  "projectName",
  "ticker",
  "contractAddress",
  "website",
  "twitter",
  "telegram",
  "discord",
  "description",
  "applicantWallet",
  "campaignPackage",
] as const;

// Basic in-memory throttle per process to slow down scripted spam.
const recent = new Map<string, number[]>();
function throttled(key: string, limit = 5, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  recent.set(key, hits);
  return hits.length > limit;
}

export async function submitApplication(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const values: Record<string, string> = {};
  for (const f of FIELDS) values[f] = String(formData.get(f) ?? "");

  // TEST MODE: the simulated payment must be acknowledged. No funds move.
  if (formData.get("testPaymentConfirmed") !== "yes") {
    return { status: "error", message: "Complete the TEST MODE payment step before submitting.", fieldErrors: { payment: "Simulated payment required" }, values };
  }

  const parsed = applicationSchema.safeParse({ ...values, acceptTerms: formData.get("acceptTerms") === "on" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, values };
  }

  if (throttled(parsed.data.applicantWallet)) {
    return { status: "error", message: "Too many submissions from this wallet. Please try again later.", fieldErrors: {}, values };
  }

  try {
    const { acceptTerms: _accepted, ...input } = parsed.data;
    void _accepted;
    const app = await getRepository().createApplication({ ...input, campaignPackage: input.campaignPackage as CampaignPackageId });
    return {
      status: "success",
      reference: app.reference,
      projectName: app.projectName,
      ticker: app.ticker,
      campaignPackage: app.campaignPackage,
      createdAt: app.createdAt,
    };
  } catch (err) {
    const message = err instanceof RepositoryError ? err.message : "Something went wrong saving your application. Please retry.";
    if (!(err instanceof RepositoryError)) console.error("submitApplication failed", err);
    return { status: "error", message, fieldErrors: {}, values };
  }
}
