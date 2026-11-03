import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { memosOf, paymentMemo, tokenDeltas, verifySwap, verifyTransfers, verifyUsdcPayment, type ParsedTxLike } from "./verify";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN = "C3bpVHLcvxnxLByNKZD21e7DW2hp5nuBBYaQ6CynU5zS";
const TREASURY = "FseP875vR2fVn9GNiMk4ExaCSeSmRaeqpBoFVAxQpqYp";
const PAYER = "9nvnHm8SYgnJXbXH3SP4QtyADNprVLKmG84Gn4bxX6NQ";
const A = "DbF5KSt39LEiJEf2uZZTwzcNvxzVxUABHXHSuK6ZSghx";
const B = "HbEForh95LJQxFHb8DnfrRwa9x6wCKB96f5ApVgcVafK";

const bal = (accountIndex: number, owner: string, mint: string, amount: bigint | number, decimals = 6) => ({
  accountIndex,
  owner,
  mint,
  uiTokenAmount: { amount: String(amount), decimals },
});

function tx(over: {
  err?: unknown;
  signers?: string[];
  pre?: ReturnType<typeof bal>[];
  post?: ReturnType<typeof bal>[];
  memo?: string;
  logs?: string[];
}): ParsedTxLike {
  const signers = over.signers ?? [PAYER];
  return {
    meta: {
      err: over.err ?? null,
      preTokenBalances: over.pre ?? [],
      postTokenBalances: over.post ?? [],
      logMessages: over.logs ?? [],
      innerInstructions: [],
    },
    transaction: {
      signatures: ["sig"],
      message: {
        accountKeys: [...signers.map((s) => ({ pubkey: s, signer: true })), { pubkey: "Other", signer: false }],
        instructions: over.memo ? [{ program: "spl-memo", programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", parsed: over.memo }] : [],
      },
    },
  };
}

describe("tokenDeltas", () => {
  it("handles accounts created in the transaction (no pre balance)", () => {
    const d = tokenDeltas(tx({ pre: [bal(1, TREASURY, USDC, 5)], post: [bal(1, TREASURY, USDC, 15), bal(2, A, USDC, 3)] }));
    assert.equal(d.get(`${TREASURY}|${USDC}`)?.delta, 10n);
    assert.equal(d.get(`${A}|${USDC}`)?.delta, 3n);
  });
  it("reads memos from logs too", () => {
    assert.deepEqual(memosOf(tx({ logs: ['Program log: Memo (len 17): "RUNNER:RUN-ABC123"'] })), ["RUNNER:RUN-ABC123"]);
  });
});

describe("verifyUsdcPayment", () => {
  const good = tx({
    memo: paymentMemo("RUN-ABC123"),
    pre: [bal(1, PAYER, USDC, 1_000_000_000), bal(2, TREASURY, USDC, 0)],
    post: [bal(1, PAYER, USDC, 0), bal(2, TREASURY, USDC, 1_000_000_000)],
  });
  const expect = { treasury: TREASURY, usdcMint: USDC, amountRaw: 1_000_000_000n, reference: "RUN-ABC123" };

  it("accepts an exact payment with the right memo", () => {
    const r = verifyUsdcPayment(good, expect);
    assert.deepEqual(r.errors, []);
    assert.equal(r.payer, PAYER);
  });
  it("rejects wrong amount, missing memo, failed tx, wrong reference", () => {
    assert.equal(verifyUsdcPayment(good, { ...expect, amountRaw: 2_500_000_000n }).ok, false);
    assert.equal(verifyUsdcPayment(good, { ...expect, reference: "RUN-ZZZZZZ" }).ok, false);
    assert.equal(verifyUsdcPayment({ ...good, meta: { ...good.meta!, err: { InstructionError: [0, "x"] } } }, expect).ok, false);
    assert.equal(verifyUsdcPayment(null, expect).ok, false);
  });
  it("rejects a payment of a different token", () => {
    const fake = tx({ memo: paymentMemo("RUN-ABC123"), pre: [], post: [bal(2, TREASURY, TOKEN, 1_000_000_000)] });
    assert.equal(verifyUsdcPayment(fake, expect).ok, false);
  });
});

describe("verifySwap", () => {
  const swap = tx({
    signers: [TREASURY],
    pre: [bal(1, TREASURY, USDC, 700_000_000), bal(2, TREASURY, TOKEN, 0, 9)],
    post: [bal(1, TREASURY, USDC, 0), bal(2, TREASURY, TOKEN, 1_842_105_263_157, 9)],
  });
  it("reads spent/received amounts", () => {
    const r = verifySwap(swap, { treasury: TREASURY, inputMint: USDC, outputMint: TOKEN });
    assert.ok(r.ok, r.errors.join());
    assert.equal(r.inputSpentRaw, 700_000_000n);
    assert.equal(r.outputReceivedRaw, 1_842_105_263_157n);
    assert.equal(r.outputDecimals, 9);
  });
  it("requires the treasury signature", () => {
    assert.equal(verifySwap({ ...swap, transaction: { ...swap.transaction, message: { ...swap.transaction.message, accountKeys: [{ pubkey: PAYER, signer: true }] } } }, { treasury: TREASURY, inputMint: USDC, outputMint: TOKEN }).ok, false);
  });
});

describe("verifyTransfers", () => {
  const batch = tx({
    signers: [TREASURY],
    pre: [bal(1, TREASURY, TOKEN, 1000), bal(2, A, TOKEN, 5)],
    post: [bal(1, TREASURY, TOKEN, 700), bal(2, A, TOKEN, 205), bal(3, B, TOKEN, 100)],
  });
  const expect = { treasury: TREASURY, mint: TOKEN, transfers: [{ owner: A, amountRaw: 200n }, { owner: B, amountRaw: 100n }] };
  it("confirms each recipient", () => {
    const r = verifyTransfers(batch, expect);
    assert.ok(r.ok, r.errors.join());
    assert.deepEqual(r.confirmedOwners, [A, B]);
  });
  it("flags a short transfer and never confirms a failed tx", () => {
    const r = verifyTransfers(batch, { ...expect, transfers: [{ owner: A, amountRaw: 201n }, { owner: B, amountRaw: 100n }] });
    assert.equal(r.ok, false);
    assert.deepEqual(r.confirmedOwners, [B]);
    const failed = verifyTransfers({ ...batch, meta: { ...batch.meta!, err: "boom" } }, expect);
    assert.deepEqual(failed.confirmedOwners, []);
  });
});
