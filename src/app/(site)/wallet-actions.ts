"use server";

import { headers } from "next/headers";
import { clearWalletSession, createChallenge, setWalletSession, verifyChallenge, WalletAuthError } from "@/lib/auth/wallet";

// Light per-IP throttle on sign-in attempts.
const attempts = new Map<string, number[]>();
async function throttled(): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
  const now = Date.now();
  const hits = (attempts.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  hits.push(now);
  attempts.set(ip, hits);
  return hits.length > 30;
}

export type WalletAuthResult = { ok: true; wallet: string } | { ok: false; message: string };

/** Step 1: get the message the wallet should sign. */
export async function startWalletSignIn(wallet: string): Promise<{ ok: true; message: string; issuedAt: string } | { ok: false; message: string }> {
  try {
    if (await throttled()) return { ok: false, message: "Too many sign-in attempts. Wait a few minutes." };
    return { ok: true, ...createChallenge(wallet) };
  } catch (e) {
    return { ok: false, message: e instanceof WalletAuthError ? e.message : "Couldn't start sign-in." };
  }
}

/** Step 2: verify the signature and start the session. */
export async function finishWalletSignIn(wallet: string, issuedAt: string, signature: string): Promise<WalletAuthResult> {
  try {
    const verified = verifyChallenge(wallet, issuedAt, signature);
    await setWalletSession(verified);
    return { ok: true, wallet: verified };
  } catch (e) {
    if (!(e instanceof WalletAuthError)) console.error("wallet sign-in failed", e);
    return { ok: false, message: e instanceof WalletAuthError ? e.message : "Sign-in failed. Please try again." };
  }
}

export async function signOutWallet(): Promise<void> {
  await clearWalletSession();
}
