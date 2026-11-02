import bs58 from "bs58";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

/**
 * Validates a Solana public key / address: base58 alphabet, 32–44 chars,
 * and decodes to exactly 32 bytes. Works for wallet and mint addresses.
 */
export function isValidSolanaAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length < 32 || v.length > 44 || !BASE58_RE.test(v)) return false;
  try {
    return bs58.decode(v).length === 32;
  } catch {
    return false;
  }
}

/** "7xKX…AsU" style shortening for display. */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function solscanTokenUrl(address: string): string {
  return `https://solscan.io/token/${encodeURIComponent(address)}`;
}

export function solscanAccountUrl(address: string): string {
  return `https://solscan.io/account/${encodeURIComponent(address)}`;
}

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${encodeURIComponent(signature)}`;
}
