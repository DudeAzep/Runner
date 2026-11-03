"use client";

import { VersionedTransaction } from "@solana/web3.js";

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

type SignFn = (<T extends VersionedTransaction>(tx: T) => Promise<T>) | undefined;

/** Asks the connected wallet to sign a server-built transaction. The server broadcasts it. */
export async function signWithWallet(signTransaction: SignFn, unsignedB64: string): Promise<string> {
  if (!signTransaction) throw new Error("This wallet can't sign transactions here. Try Phantom, Solflare, or Backpack.");
  const tx = VersionedTransaction.deserialize(b64ToBytes(unsignedB64));
  const signed = await signTransaction(tx);
  return bytesToB64(signed.serialize());
}

export function explorerTx(signature: string, cluster: "mainnet-beta" | "devnet"): string {
  return `https://solscan.io/tx/${signature}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
}

export function walletErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/reject|denied|cancel/i.test(msg)) return "You cancelled the request in your wallet.";
  return msg.slice(0, 240);
}
