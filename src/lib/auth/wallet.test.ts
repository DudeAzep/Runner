import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { before, describe, it } from "node:test";
import bs58 from "bs58";

process.env.ADMIN_SESSION_SECRET = "test-secret-".padEnd(48, "x");

let wallet: typeof import("./wallet");
before(async () => {
  wallet = await import("./wallet");
});

/** A fresh ed25519 keypair with its Solana (base58) address. */
function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
  return { address: bs58.encode(raw), privateKey };
}

describe("wallet sign-in", () => {
  it("accepts a signature from the wallet's own key", () => {
    const kp = keypair();
    const { message, issuedAt } = wallet.createChallenge(kp.address);
    const sig = bs58.encode(sign(null, Buffer.from(message), kp.privateKey));
    assert.equal(wallet.verifyChallenge(kp.address, issuedAt, sig), kp.address);
  });

  it("rejects a signature from a different key", () => {
    const owner = keypair();
    const attacker = keypair();
    const { message, issuedAt } = wallet.createChallenge(owner.address);
    const sig = bs58.encode(sign(null, Buffer.from(message), attacker.privateKey));
    assert.throws(() => wallet.verifyChallenge(owner.address, issuedAt, sig), /doesn't match/);
  });

  it("rejects a tampered or expired challenge", () => {
    const kp = keypair();
    const { message, issuedAt } = wallet.createChallenge(kp.address);
    const sig = bs58.encode(sign(null, Buffer.from(message), kp.privateKey));
    // Changing the timestamp changes the expected message, so the signature no longer matches.
    const shifted = new Date(Date.parse(issuedAt) - 1000).toISOString();
    assert.throws(() => wallet.verifyChallenge(kp.address, shifted, sig), /doesn't match/);
    const old = new Date(Date.now() - 10 * 60_000).toISOString();
    assert.throws(() => wallet.verifyChallenge(kp.address, old, sig), /expired/);
  });

  it("rejects garbage input", () => {
    const kp = keypair();
    const { issuedAt } = wallet.createChallenge(kp.address);
    assert.throws(() => wallet.verifyChallenge(kp.address, issuedAt, "not-base58-0OIl"), /Invalid signature/);
    assert.throws(() => wallet.createChallenge("not-a-wallet"), /valid Solana wallet/);
  });
});
