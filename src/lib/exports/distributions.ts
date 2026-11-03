import { fromBaseUnits } from "@/lib/economics/rewards";
import type { Campaign, Distribution } from "@/lib/types";

const HEADERS = [
  "campaign_id", "project_name", "ticker", "token_mint", "distribution_id", "snapshot_id",
  "wallet_address", "runner_balance_raw", "runner_decimals", "runner_balance", "eligible_supply_raw",
  "reward_percentage", "reward_amount_raw", "reward_decimals", "reward_amount", "status",
  "transaction_signature", "source", "created_at", "updated_at",
] as const;

function cell(value: string | number | null): string {
  const text = value == null ? "" : String(value);
  // Quoting alone does not stop spreadsheets from executing a text cell as a formula.
  const safe = /^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** All stored rows, with exact base-unit strings and explicit provenance/status. */
export function distributionsCsv(
  campaign: Pick<Campaign, "id" | "projectName" | "ticker" | "tokenAddress">,
  distributions: readonly Distribution[],
): string {
  const rows = distributions.map((d) => [
    campaign.id, campaign.projectName, campaign.ticker, campaign.tokenAddress, d.id, d.snapshotId,
    d.walletAddress, d.runnerBalance, d.runnerDecimals,
    fromBaseUnits(BigInt(d.runnerBalance), d.runnerDecimals), d.eligibleSupply,
    d.rewardPercentage, d.rewardAmountRaw, d.rewardDecimals,
    fromBaseUnits(BigInt(d.rewardAmountRaw), d.rewardDecimals), d.distributionStatus,
    d.transactionSignature, d.source, d.createdAt, d.updatedAt,
  ].map(cell).join(","));
  // BOM for UTF-8 project names in spreadsheet apps; CRLF for CSV interoperability.
  return `\uFEFF${[HEADERS.map(cell).join(","), ...rows].join("\r\n")}\r\n`;
}
