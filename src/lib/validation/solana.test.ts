import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applicationSchema } from "./schemas";
import { isValidSolanaAddress, shortenAddress } from "./solana";

describe("isValidSolanaAddress", () => {
  it("accepts 32-byte base58 keys", () => {
    assert.ok(isValidSolanaAddress("So11111111111111111111111111111111111111112"));
    assert.ok(isValidSolanaAddress("DbF5KSt39LEiJEf2uZZTwzcNvxzVxUABHXHSuK6ZSghx"));
  });
  it("rejects bad input", () => {
    for (const v of ["", "0xabc", "O0Il" + "1".repeat(40), "short", "1".repeat(50), 123, null]) {
      assert.equal(isValidSolanaAddress(v), false, String(v));
    }
  });
  it("shortens", () => {
    assert.equal(shortenAddress("DbF5KSt39LEiJEf2uZZTwzcNvxzVxUABHXHSuK6ZSghx"), "DbF5…Sghx");
  });
});

describe("applicationSchema", () => {
  const valid = {
    projectName: "Test Project",
    ticker: "$test",
    contractAddress: "C3bpVHLcvxnxLByNKZD21e7DW2hp5nuBBYaQ6CynU5zS",
    website: "https://test.example",
    twitter: "https://x.com/test",
    telegram: "https://t.me/test",
    discord: "https://discord.gg/test",
    description: "A sufficiently long description of the test project for validation.",
    campaignPackage: "growth",
    acceptTerms: true,
  };
  it("normalizes ticker and accepts a valid application", () => {
    const r = applicationSchema.safeParse(valid);
    assert.ok(r.success);
    assert.equal(r.data.ticker, "TEST");
  });
  it("rejects wrong social hosts and bad addresses", () => {
    assert.equal(applicationSchema.safeParse({ ...valid, twitter: "https://evil.com/x.com" }).success, false);
    assert.equal(applicationSchema.safeParse({ ...valid, contractAddress: "not-a-mint" }).success, false);
    assert.equal(applicationSchema.safeParse({ ...valid, website: "http://insecure.example" }).success, false);
    assert.equal(applicationSchema.safeParse({ ...valid, acceptTerms: false }).success, false);
    assert.equal(applicationSchema.safeParse({ ...valid, campaignPackage: "platinum" }).success, false);
  });
});
