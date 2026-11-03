import "server-only";
import { isValidSolanaAddress } from "@/lib/validation/solana";

/**
 * Runtime configuration, read on the server from environment variables
 * (.env.local). Nothing here is a secret except ADMIN_* which never leaves
 * the server. The public subset is passed to the browser via props, so you
 * can change settings and restart without rebuilding.
 */

export type Cluster = "mainnet-beta" | "devnet";

export const USDC_MINTS: Record<Cluster, string> = {
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};
export const USDC_DECIMALS = 6;

const DEFAULT_RPC: Record<Cluster, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
};

function addressOrNull(v: string | undefined): string | null {
  const s = v?.trim();
  return s && isValidSolanaAddress(s) ? s : null;
}

export interface PublicConfig {
  cluster: Cluster;
  usdcMint: string;
  treasuryWallet: string | null;
  runnerMint: string | null;
  paymentsLive: boolean;
  treasuryLive: boolean;
}

export interface ServerConfig extends PublicConfig {
  rpcUrl: string;
  rpcIsDefault: boolean;
  excludedWallets: string[];
  jupiterApiUrl: string;
  jupiterApiKey: string | null;
  slippageBps: number;
  distributionBatchSize: number;
  problems: string[];
}

export function getConfig(): ServerConfig {
  const cluster: Cluster = process.env.SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet-beta";
  const treasuryWallet = addressOrNull(process.env.TREASURY_WALLET);
  const runnerMint = addressOrNull(process.env.RUNNER_MINT);
  const wantsLivePayments = process.env.PAYMENTS_MODE === "live";
  const wantsLiveTreasury = process.env.TREASURY_MODE === "live";
  const problems: string[] = [];

  if (process.env.TREASURY_WALLET && !treasuryWallet) problems.push("TREASURY_WALLET is not a valid Solana address.");
  if (process.env.RUNNER_MINT && !runnerMint) problems.push("RUNNER_MINT is not a valid Solana address.");
  if (wantsLivePayments && !treasuryWallet) problems.push("PAYMENTS_MODE=live needs TREASURY_WALLET. Payments stay in TEST MODE.");
  if (wantsLiveTreasury && !treasuryWallet) problems.push("TREASURY_MODE=live needs TREASURY_WALLET. Purchases and distributions stay simulated.");

  const excludedWallets = (process.env.RUNNER_EXCLUDED_WALLETS ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => isValidSolanaAddress(s));
  if (treasuryWallet && !excludedWallets.includes(treasuryWallet)) excludedWallets.push(treasuryWallet);

  const rpcFromEnv = process.env.SOLANA_RPC_URL?.trim();
  const slippage = Number(process.env.SWAP_SLIPPAGE_BPS ?? 100);
  const batch = Number(process.env.DISTRIBUTION_BATCH_SIZE ?? 5);

  return {
    cluster,
    usdcMint: USDC_MINTS[cluster],
    treasuryWallet,
    runnerMint,
    paymentsLive: wantsLivePayments && Boolean(treasuryWallet),
    treasuryLive: wantsLiveTreasury && Boolean(treasuryWallet),
    rpcUrl: rpcFromEnv || DEFAULT_RPC[cluster],
    rpcIsDefault: !rpcFromEnv,
    excludedWallets,
    jupiterApiUrl: (process.env.JUPITER_API_URL || "https://lite-api.jup.ag/swap/v1").replace(/\/$/, ""),
    jupiterApiKey: process.env.JUPITER_API_KEY?.trim() || null,
    slippageBps: Number.isInteger(slippage) && slippage >= 10 && slippage <= 1000 ? slippage : 100,
    distributionBatchSize: Number.isInteger(batch) && batch >= 1 && batch <= 8 ? batch : 5,
    problems,
  };
}

export function getPublicConfig(): PublicConfig {
  const c = getConfig();
  return {
    cluster: c.cluster,
    usdcMint: c.usdcMint,
    treasuryWallet: c.treasuryWallet,
    runnerMint: c.runnerMint,
    paymentsLive: c.paymentsLive,
    treasuryLive: c.treasuryLive,
  };
}
