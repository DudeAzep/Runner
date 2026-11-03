/**
 * Pure verification of confirmed Solana transactions (no network access).
 *
 * The server fetches a transaction with `getParsedTransaction` and these
 * functions decide whether it proves what we expect: a USDC payment, a
 * treasury swap, or a batch of reward transfers. Everything is checked from
 * the transaction's own pre/post token balances, never from client input.
 */

export interface UiTokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
}

export interface ParsedIx {
  program?: string;
  programId: string | { toBase58(): string };
  parsed?: unknown;
}

/** Minimal structural subset of web3.js ParsedTransactionWithMeta. */
export interface ParsedTxLike {
  slot?: number;
  blockTime?: number | null;
  meta: {
    err: unknown;
    preTokenBalances?: UiTokenBalance[] | null;
    postTokenBalances?: UiTokenBalance[] | null;
    logMessages?: string[] | null;
    innerInstructions?: { instructions: ParsedIx[] }[] | null;
  } | null;
  transaction: {
    signatures: string[];
    message: {
      accountKeys: { pubkey: string | { toBase58(): string }; signer: boolean }[];
      instructions: ParsedIx[];
    };
  };
}

export interface VerifyResult {
  ok: boolean;
  errors: string[];
}

const key = (k: string | { toBase58(): string }) => (typeof k === "string" ? k : k.toBase58());

export function signersOf(tx: ParsedTxLike): string[] {
  return tx.transaction.message.accountKeys.filter((a) => a.signer).map((a) => key(a.pubkey));
}

/** Net change per (owner, mint) in base units, derived from pre/post token balances. */
export function tokenDeltas(tx: ParsedTxLike): Map<string, { owner: string; mint: string; delta: bigint; decimals: number }> {
  const out = new Map<string, { owner: string; mint: string; delta: bigint; decimals: number }>();
  const add = (b: UiTokenBalance, sign: 1n | -1n) => {
    if (!b.owner) return;
    const k = `${b.owner}|${b.mint}`;
    const cur = out.get(k) ?? { owner: b.owner, mint: b.mint, delta: 0n, decimals: b.uiTokenAmount.decimals };
    cur.delta += sign * BigInt(b.uiTokenAmount.amount);
    out.set(k, cur);
  };
  for (const b of tx.meta?.preTokenBalances ?? []) add(b, -1n);
  for (const b of tx.meta?.postTokenBalances ?? []) add(b, 1n);
  return out;
}

export function deltaFor(tx: ParsedTxLike, owner: string, mint: string): { delta: bigint; decimals: number | null } {
  const d = tokenDeltas(tx).get(`${owner}|${mint}`);
  return { delta: d?.delta ?? 0n, decimals: d?.decimals ?? null };
}

/** Memo strings from SPL Memo instructions (top-level and inner) and program logs. */
export function memosOf(tx: ParsedTxLike): string[] {
  const memos: string[] = [];
  const all = [...tx.transaction.message.instructions, ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions)];
  for (const ix of all) {
    if (ix.program === "spl-memo" && typeof ix.parsed === "string") memos.push(ix.parsed);
  }
  for (const line of tx.meta?.logMessages ?? []) {
    const m = /^Program log: Memo \(len \d+\): "(.*)"$/.exec(line);
    if (m?.[1]) memos.push(m[1].replace(/\\"/g, '"'));
  }
  return memos;
}

export function paymentMemo(reference: string): string {
  return `RUNNER:${reference}`;
}

/** Proves a USDC payment of exactly `amountRaw` to the treasury, tagged with the application reference. */
export function verifyUsdcPayment(
  tx: ParsedTxLike | null,
  expect: { treasury: string; usdcMint: string; amountRaw: bigint; reference: string },
): VerifyResult & { payer: string | null } {
  const errors: string[] = [];
  if (!tx) return { ok: false, errors: ["Transaction not found (not confirmed yet?)"], payer: null };
  if (!tx.meta) errors.push("Transaction has no metadata.");
  else if (tx.meta.err) errors.push("Transaction failed on-chain.");
  const received = deltaFor(tx, expect.treasury, expect.usdcMint).delta;
  if (received !== expect.amountRaw) {
    errors.push(`Treasury received ${received.toString()} USDC base units; expected ${expect.amountRaw.toString()}.`);
  }
  if (!memosOf(tx).some((m) => m.includes(paymentMemo(expect.reference)))) {
    errors.push(`Missing memo "${paymentMemo(expect.reference)}".`);
  }
  const payer = signersOf(tx)[0] ?? null;
  if (payer && deltaFor(tx, payer, expect.usdcMint).delta >= 0n) errors.push("Fee payer did not send USDC.");
  return { ok: errors.length === 0, errors, payer };
}

/** Reads a treasury swap: how much input was spent and output received. */
export function verifySwap(
  tx: ParsedTxLike | null,
  expect: { treasury: string; inputMint: string; outputMint: string },
): VerifyResult & { inputSpentRaw: bigint; outputReceivedRaw: bigint; outputDecimals: number | null } {
  const errors: string[] = [];
  const empty = { inputSpentRaw: 0n, outputReceivedRaw: 0n, outputDecimals: null };
  if (!tx) return { ok: false, errors: ["Transaction not found (not confirmed yet?)"], ...empty };
  if (!tx.meta) errors.push("Transaction has no metadata.");
  else if (tx.meta.err) errors.push("Swap failed on-chain.");
  if (!signersOf(tx).includes(expect.treasury)) errors.push("Treasury wallet did not sign this transaction.");
  const input = deltaFor(tx, expect.treasury, expect.inputMint);
  const output = deltaFor(tx, expect.treasury, expect.outputMint);
  if (input.delta >= 0n) errors.push("Treasury USDC balance did not decrease.");
  if (output.delta <= 0n) errors.push("Treasury did not receive the project token.");
  return {
    ok: errors.length === 0,
    errors,
    inputSpentRaw: input.delta < 0n ? -input.delta : 0n,
    outputReceivedRaw: output.delta > 0n ? output.delta : 0n,
    outputDecimals: output.decimals,
  };
}

/** Proves each recipient received exactly their reward from the treasury in this transaction. */
export function verifyTransfers(
  tx: ParsedTxLike | null,
  expect: { treasury: string; mint: string; transfers: { owner: string; amountRaw: bigint }[] },
): VerifyResult & { confirmedOwners: string[] } {
  const errors: string[] = [];
  if (!tx) return { ok: false, errors: ["Transaction not found (not confirmed yet?)"], confirmedOwners: [] };
  if (!tx.meta) errors.push("Transaction has no metadata.");
  else if (tx.meta.err) errors.push("Transaction failed on-chain.");
  if (!signersOf(tx).includes(expect.treasury)) errors.push("Treasury wallet did not sign this transaction.");
  const owners = new Set<string>();
  const confirmedOwners: string[] = [];
  let total = 0n;
  for (const t of expect.transfers) {
    if (owners.has(t.owner)) errors.push(`Duplicate recipient ${t.owner} in batch.`);
    owners.add(t.owner);
    total += t.amountRaw;
    const got = deltaFor(tx, t.owner, expect.mint).delta;
    if (got === t.amountRaw) confirmedOwners.push(t.owner);
    else errors.push(`${t.owner} received ${got.toString()}; expected ${t.amountRaw.toString()}.`);
  }
  const sent = deltaFor(tx, expect.treasury, expect.mint).delta;
  if (-sent !== total) errors.push(`Treasury sent ${(-sent).toString()}; expected ${total.toString()}.`);
  const failed = Boolean(tx.meta?.err) || !signersOf(tx).includes(expect.treasury);
  return { ok: errors.length === 0, errors, confirmedOwners: failed ? [] : confirmedOwners };
}
