import "server-only";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type ParsedAccountData,
} from "@solana/web3.js";
import bs58 from "bs58";
import { getConfig, USDC_DECIMALS } from "@/lib/config";
import type { TokenReport } from "@/lib/types";
import type { ParsedTxLike } from "./verify";

/**
 * All Solana network access happens here, on the server, through one RPC URL
 * (SOLANA_RPC_URL). The browser only asks the user's wallet to SIGN
 * transactions; the server builds, submits, confirms and verifies them.
 * The server never holds a private key.
 */

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

let cached: { url: string; conn: Connection } | undefined;
export function connection(): Connection {
  const url = getConfig().rpcUrl;
  if (!cached || cached.url !== url) cached = { url, conn: new Connection(url, { commitment: "confirmed" }) };
  return cached.conn;
}

export class SolanaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SolanaError";
  }
}

function friendly(err: unknown, what: string): SolanaError {
  const msg = err instanceof Error ? err.message : String(err);
  if (/429|Too Many Requests/i.test(msg)) return new SolanaError(`${what}: the Solana RPC is rate-limiting requests. Set SOLANA_RPC_URL to a dedicated RPC (e.g. a free Helius key).`);
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|timeout/i.test(msg)) return new SolanaError(`${what}: could not reach the Solana RPC (${getConfig().rpcUrl}).`);
  return new SolanaError(`${what}: ${msg.slice(0, 300)}`);
}

/* ------------------------------ Encoding helpers ------------------------------ */

export const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
export const fromBase64 = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));

export function decodeSigned(b64: string): { tx: VersionedTransaction; signature: string; feePayer: string } {
  let tx: VersionedTransaction;
  try {
    tx = VersionedTransaction.deserialize(fromBase64(b64));
  } catch {
    throw new SolanaError("The signed transaction could not be decoded.");
  }
  const sig = tx.signatures[0];
  if (!sig || sig.every((b) => b === 0)) throw new SolanaError("The transaction is not signed.");
  return { tx, signature: bs58.encode(sig), feePayer: tx.message.staticAccountKeys[0]!.toBase58() };
}

/* ------------------------------- Read helpers -------------------------------- */

export async function getMintInfo(mint: string): Promise<{ decimals: number; supply: string; mintAuthority: string | null; freezeAuthority: string | null; programId: PublicKey }> {
  try {
    const res = await connection().getParsedAccountInfo(new PublicKey(mint));
    const v = res.value;
    if (!v) throw new SolanaError("Mint account not found on this cluster.");
    const data = v.data as ParsedAccountData;
    if (!data?.parsed || data.parsed.type !== "mint") throw new SolanaError("Address is not an SPL token mint.");
    const info = data.parsed.info as { decimals: number; supply: string; mintAuthority: string | null; freezeAuthority: string | null };
    return { decimals: info.decimals, supply: info.supply, mintAuthority: info.mintAuthority, freezeAuthority: info.freezeAuthority, programId: v.owner };
  } catch (e) {
    throw e instanceof SolanaError ? e : friendly(e, "Mint lookup failed");
  }
}

/** Sum of an owner's balance for a mint, in base units. */
export async function getTokenBalance(owner: string, mint: string): Promise<{ raw: bigint; decimals: number | null }> {
  try {
    const res = await connection().getParsedTokenAccountsByOwner(new PublicKey(owner), { mint: new PublicKey(mint) });
    let raw = 0n;
    let decimals: number | null = null;
    for (const a of res.value) {
      const amt = (a.account.data as ParsedAccountData).parsed.info.tokenAmount as { amount: string; decimals: number };
      raw += BigInt(amt.amount);
      decimals = amt.decimals;
    }
    return { raw, decimals };
  } catch (e) {
    throw friendly(e, "Balance lookup failed");
  }
}

export async function rpcHealth(): Promise<{ ok: boolean; slot?: number; error?: string }> {
  try {
    return { ok: true, slot: await connection().getSlot() };
  } catch (e) {
    return { ok: false, error: friendly(e, "RPC check").message };
  }
}

/* ------------------------------ Token screening ------------------------------ */

interface DexPair {
  priceUsd?: string;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: number };
  pairCreatedAt?: number;
  url?: string;
}

/** Collects verifiable facts about a token for screening: on-chain mint data + DexScreener market data. */
export async function fetchTokenReport(applicationId: string, mint: string): Promise<TokenReport> {
  const errors: string[] = [];
  const report: TokenReport = {
    id: `rep-${globalThis.crypto.randomUUID()}`,
    applicationId,
    mint,
    fetchedAt: new Date().toISOString(),
    tokenProgram: null,
    decimals: null,
    supply: null,
    mintAuthority: null,
    freezeAuthority: null,
    top10Pct: null,
    largestAccounts: [],
    priceUsd: null,
    marketCapUsd: null,
    fdvUsd: null,
    liquidityUsd: null,
    volume24hUsd: null,
    pairUrl: null,
    pairCreatedAt: null,
    holderCount: null,
    errors,
  };

  try {
    const m = await getMintInfo(mint);
    report.decimals = m.decimals;
    report.supply = m.supply;
    report.mintAuthority = m.mintAuthority;
    report.freezeAuthority = m.freezeAuthority;
    report.tokenProgram = m.programId.equals(TOKEN_2022_PROGRAM_ID) ? "Token-2022" : m.programId.equals(TOKEN_PROGRAM_ID) ? "SPL Token" : m.programId.toBase58();

    try {
      const largest = await connection().getTokenLargestAccounts(new PublicKey(mint));
      const supply = BigInt(m.supply);
      report.largestAccounts = largest.value.slice(0, 20).map((a) => ({
        address: a.address.toBase58(),
        amount: a.amount,
        pct: supply > 0n ? Number((BigInt(a.amount) * 1_000_000n) / supply) / 10_000 : 0,
      }));
      const top10 = largest.value.slice(0, 10).reduce((s, a) => s + BigInt(a.amount), 0n);
      report.top10Pct = supply > 0n ? Number((top10 * 1_000_000n) / supply) / 10_000 : null;
    } catch (e) {
      errors.push(friendly(e, "Largest holders").message);
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const pairs = (await res.json()) as DexPair[];
    const best = [...(Array.isArray(pairs) ? pairs : [])].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    if (best) {
      report.priceUsd = best.priceUsd ? Number(best.priceUsd) : null;
      report.liquidityUsd = best.liquidity?.usd ?? null;
      report.marketCapUsd = best.marketCap ?? null;
      report.fdvUsd = best.fdv ?? null;
      report.volume24hUsd = best.volume?.h24 ?? null;
      report.pairUrl = best.url ?? null;
      report.pairCreatedAt = best.pairCreatedAt ? new Date(best.pairCreatedAt).toISOString() : null;
    } else {
      errors.push("DexScreener: no trading pairs found for this token.");
    }
  } catch (e) {
    errors.push(`DexScreener unavailable: ${e instanceof Error ? e.message : String(e)}`);
  }
  return report;
}

/* -------------------------------- Snapshots --------------------------------- */

/** Every holder of a mint (both token programs), aggregated by owner. Needs an RPC that allows getProgramAccounts. */
export async function fetchAllHolders(mint: string): Promise<{ holders: { wallet: string; balance: string }[]; decimals: number; slot: number }> {
  const m = await getMintInfo(mint);
  const conn = connection();
  try {
    const slot = await conn.getSlot();
    const filters = m.programId.equals(TOKEN_PROGRAM_ID)
      ? [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: mint } }]
      : [{ memcmp: { offset: 0, bytes: mint } }];
    const accounts = await conn.getParsedProgramAccounts(m.programId, { filters });
    const byOwner = new Map<string, bigint>();
    for (const a of accounts) {
      const parsed = (a.account.data as ParsedAccountData).parsed;
      if (parsed?.type !== "account") continue;
      const info = parsed.info as { owner: string; mint: string; tokenAmount: { amount: string } };
      if (info.mint !== mint) continue;
      const amt = BigInt(info.tokenAmount.amount);
      if (amt > 0n) byOwner.set(info.owner, (byOwner.get(info.owner) ?? 0n) + amt);
    }
    return { holders: [...byOwner].map(([wallet, b]) => ({ wallet, balance: b.toString() })), decimals: m.decimals, slot };
  } catch (e) {
    throw friendly(e, "Holder snapshot failed (your RPC may not allow getProgramAccounts — use a dedicated RPC or upload a CSV)");
  }
}

/* --------------------------- Transaction building --------------------------- */

async function compile(payer: PublicKey, instructions: TransactionInstruction[]) {
  const { blockhash, lastValidBlockHeight } = await connection().getLatestBlockhash("confirmed");
  const message = new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  return { transaction: toBase64(tx.serialize()), blockhash, lastValidBlockHeight };
}

export interface PreparedTx {
  transaction: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

/** USDC payment from the applicant to the treasury, tagged with the application reference memo. */
export async function buildUsdcPayment(args: { payer: string; amountRaw: bigint; memo: string }): Promise<PreparedTx> {
  const cfg = getConfig();
  if (!cfg.treasuryWallet) throw new SolanaError("Treasury wallet is not configured.");
  try {
    const payer = new PublicKey(args.payer);
    const treasury = new PublicKey(cfg.treasuryWallet);
    const mint = new PublicKey(cfg.usdcMint);
    const from = getAssociatedTokenAddressSync(mint, payer, true, TOKEN_PROGRAM_ID);
    const to = getAssociatedTokenAddressSync(mint, treasury, true, TOKEN_PROGRAM_ID);
    const fromInfo = await connection().getParsedAccountInfo(from);
    if (!fromInfo.value) throw new SolanaError("This wallet has no USDC account. Fund it with USDC first.");
    const bal = BigInt(((fromInfo.value.data as ParsedAccountData).parsed.info.tokenAmount as { amount: string }).amount);
    if (bal < args.amountRaw) throw new SolanaError(`Insufficient USDC: wallet has ${Number(bal) / 10 ** USDC_DECIMALS}, needs ${Number(args.amountRaw) / 10 ** USDC_DECIMALS}.`);
    return await compile(payer, [
      createAssociatedTokenAccountIdempotentInstruction(payer, to, treasury, mint, TOKEN_PROGRAM_ID),
      createTransferCheckedInstruction(from, mint, to, payer, args.amountRaw, USDC_DECIMALS, [], TOKEN_PROGRAM_ID),
      new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [{ pubkey: payer, isSigner: true, isWritable: false }], data: Buffer.from(args.memo, "utf8") }),
    ]);
  } catch (e) {
    throw e instanceof SolanaError ? e : friendly(e, "Could not prepare payment");
  }
}

/** One batch of reward transfers from the treasury. Creates recipient token accounts when missing (treasury pays rent). */
export async function buildRewardBatch(args: { mint: string; transfers: { owner: string; amountRaw: bigint }[] }): Promise<PreparedTx & { decimals: number }> {
  const cfg = getConfig();
  if (!cfg.treasuryWallet) throw new SolanaError("Treasury wallet is not configured.");
  const m = await getMintInfo(args.mint);
  try {
    const treasury = new PublicKey(cfg.treasuryWallet);
    const mint = new PublicKey(args.mint);
    const source = getAssociatedTokenAddressSync(mint, treasury, true, m.programId);
    const ixs: TransactionInstruction[] = [ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 * args.transfers.length + 20_000 })];
    for (const t of args.transfers) {
      const owner = new PublicKey(t.owner);
      const dest = getAssociatedTokenAddressSync(mint, owner, true, m.programId);
      ixs.push(createAssociatedTokenAccountIdempotentInstruction(treasury, dest, owner, mint, m.programId));
      ixs.push(createTransferCheckedInstruction(source, mint, dest, treasury, t.amountRaw, m.decimals, [], m.programId));
    }
    return { ...(await compile(treasury, ixs)), decimals: m.decimals };
  } catch (e) {
    throw friendly(e, "Could not prepare distribution batch");
  }
}

/* ----------------------------- Submit & confirm ------------------------------ */

export async function fetchParsedTx(signature: string): Promise<ParsedTxLike | null> {
  try {
    const tx = await connection().getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
    return tx as unknown as ParsedTxLike | null;
  } catch (e) {
    throw friendly(e, "Transaction lookup failed");
  }
}

/** Broadcasts a wallet-signed transaction, waits for confirmation, and returns the parsed result. */
export async function submitAndConfirm(signedB64: string, prepared?: { blockhash: string; lastValidBlockHeight: number }): Promise<{ signature: string; parsed: ParsedTxLike | null }> {
  const { tx, signature } = decodeSigned(signedB64);
  const conn = connection();
  try {
    await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
    const bh = prepared ?? { blockhash: tx.message.recentBlockhash, lastValidBlockHeight: (await conn.getLatestBlockhash("confirmed")).lastValidBlockHeight };
    const res = await conn.confirmTransaction({ signature, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, "confirmed");
    if (res.value.err) {
      return { signature, parsed: await fetchParsedTx(signature) };
    }
    // Parsed data can lag confirmation by a moment.
    for (let i = 0; i < 5; i++) {
      const parsed = await fetchParsedTx(signature);
      if (parsed) return { signature, parsed };
      await new Promise((r) => setTimeout(r, 800));
    }
    return { signature, parsed: null };
  } catch (e) {
    throw friendly(e, "Transaction failed");
  }
}

/* --------------------------------- Jupiter ---------------------------------- */

export interface SwapQuote {
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  routeLabels: string[];
  raw: unknown;
}

async function jupiter<T>(path: string, init?: RequestInit): Promise<T> {
  const cfg = getConfig();
  const res = await fetch(`${cfg.jupiterApiUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(cfg.jupiterApiKey ? { "x-api-key": cfg.jupiterApiKey } : {}), ...init?.headers },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const body = await res.text();
  if (!res.ok) throw new SolanaError(`Jupiter ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body) as T;
}

/** Quote + unsigned swap transaction for USDC → project token, to be signed by the treasury wallet. */
export async function buildTreasurySwap(args: { outputMint: string; usdcRaw: bigint }): Promise<{ quote: SwapQuote; transaction: string; lastValidBlockHeight: number }> {
  const cfg = getConfig();
  if (!cfg.treasuryWallet) throw new SolanaError("Treasury wallet is not configured.");
  if (cfg.cluster !== "mainnet-beta") throw new SolanaError("Jupiter swaps are only available on mainnet. Use simulated purchases on devnet.");
  try {
    const q = new URLSearchParams({
      inputMint: cfg.usdcMint,
      outputMint: args.outputMint,
      amount: args.usdcRaw.toString(),
      slippageBps: String(cfg.slippageBps),
      restrictIntermediateTokens: "true",
    });
    const quote = await jupiter<{ inAmount: string; outAmount: string; otherAmountThreshold: string; priceImpactPct: string; routePlan?: { swapInfo?: { label?: string } }[] }>(`/quote?${q}`);
    const swap = await jupiter<{ swapTransaction: string; lastValidBlockHeight: number }>("/swap", {
      method: "POST",
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: cfg.treasuryWallet,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });
    return {
      quote: {
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        otherAmountThreshold: quote.otherAmountThreshold,
        priceImpactPct: quote.priceImpactPct,
        routeLabels: (quote.routePlan ?? []).map((r) => r.swapInfo?.label ?? "?"),
        raw: quote,
      },
      transaction: swap.swapTransaction,
      lastValidBlockHeight: swap.lastValidBlockHeight,
    };
  } catch (e) {
    throw e instanceof SolanaError ? e : friendly(e, "Jupiter swap preparation failed");
  }
}
