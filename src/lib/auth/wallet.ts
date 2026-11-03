import "server-only";
import { createHmac, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import bs58 from "bs58";
import { cookies } from "next/headers";
import { isValidSolanaAddress } from "@/lib/validation/solana";
import { getSessionSecret } from "./session-token";

/**
 * "Sign in with Solana": the user's wallet signs a short text message (free,
 * no transaction). The server checks the ed25519 signature and then keeps the
 * wallet in a signed, httpOnly cookie. This proves the visitor controls the
 * wallet, so applications and payments can be tied to it safely.
 */

export const WALLET_COOKIE = "runner_wallet_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const CHALLENGE_TTL_MS = 5 * 60_000; // a signed message is accepted for 5 minutes

/** Domain-separated key, so wallet tokens can never be confused with admin tokens. */
function walletSecret(): string | null {
  const s = getSessionSecret();
  return s ? `${s}:wallet-session` : null;
}

function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function safeEq(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function loginMessage(wallet: string, issuedAt: string, nonce: string): string {
  return [
    "Sign in to RUNNER",
    "",
    "This proves you own this wallet. It is free: no transaction is sent and nothing is charged.",
    "",
    `Wallet: ${wallet}`,
    `Issued: ${issuedAt}`,
    `Nonce: ${nonce}`,
  ].join("\n");
}

export class WalletAuthError extends Error {}

/** A message for the wallet to sign. The nonce is an HMAC, so the server needs no storage to check it later. */
export function createChallenge(wallet: string): { message: string; issuedAt: string } {
  const secret = walletSecret();
  if (!secret) throw new WalletAuthError("Wallet sign-in isn't configured on this server (run npm run setup).");
  if (!isValidSolanaAddress(wallet)) throw new WalletAuthError("That isn't a valid Solana wallet.");
  const issuedAt = new Date().toISOString();
  const nonce = hmac(secret, `challenge|${wallet}|${issuedAt}`).slice(0, 24);
  return { message: loginMessage(wallet, issuedAt, nonce), issuedAt };
}

/** Checks the wallet's signature over the challenge. Returns the verified wallet. */
export function verifyChallenge(wallet: string, issuedAt: string, signatureB58: string): string {
  const secret = walletSecret();
  if (!secret) throw new WalletAuthError("Wallet sign-in isn't configured on this server.");
  if (!isValidSolanaAddress(wallet)) throw new WalletAuthError("That isn't a valid Solana wallet.");
  const issued = Date.parse(issuedAt);
  if (!Number.isFinite(issued) || Date.now() - issued > CHALLENGE_TTL_MS || issued - Date.now() > 60_000) {
    throw new WalletAuthError("The sign-in request expired. Please try again.");
  }
  const nonce = hmac(secret, `challenge|${wallet}|${issuedAt}`).slice(0, 24);
  const message = Buffer.from(loginMessage(wallet, issuedAt, nonce), "utf8");

  let signature: Uint8Array;
  try {
    signature = bs58.decode(signatureB58);
  } catch {
    throw new WalletAuthError("Invalid signature.");
  }
  if (signature.length !== 64) throw new WalletAuthError("Invalid signature.");

  // Wrap the raw 32-byte ed25519 public key in its standard DER header for Node's crypto.
  const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(bs58.decode(wallet))]);
  const key = createPublicKey({ key: der, format: "der", type: "spki" });
  if (!verify(null, message, key, signature)) throw new WalletAuthError("The signature doesn't match this wallet.");
  return wallet;
}

function signSession(wallet: string, exp: number, secret: string): string {
  const body = Buffer.from(JSON.stringify({ w: wallet, exp })).toString("base64url");
  return `${body}.${hmac(secret, body)}`;
}

function readSession(token: string | undefined, secret: string | null): string | null {
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEq(sig, hmac(secret, body))) return null;
  try {
    const { w, exp } = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { w: string; exp: number };
    if (typeof exp !== "number" || exp < Math.floor(Date.now() / 1000)) return null;
    return isValidSolanaAddress(w) ? w : null;
  } catch {
    return null;
  }
}

export async function setWalletSession(wallet: string): Promise<void> {
  const secret = walletSecret();
  if (!secret) throw new WalletAuthError("Wallet sign-in isn't configured on this server.");
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  (await cookies()).set(WALLET_COOKIE, signSession(wallet, exp, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearWalletSession(): Promise<void> {
  (await cookies()).delete(WALLET_COOKIE);
}

/** The signed-in wallet for this request, or null. The single source of truth for applicant identity. */
export async function getWalletSession(): Promise<string | null> {
  return readSession((await cookies()).get(WALLET_COOKIE)?.value, walletSecret());
}
