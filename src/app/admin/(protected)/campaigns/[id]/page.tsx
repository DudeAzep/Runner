import { ArrowLeft, ArrowUpRight, Camera, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AdminForm } from "@/components/admin/AdminForm";
import { DistributionSender } from "@/components/admin/DistributionSender";
import { TreasurySwapPanel } from "@/components/admin/TreasurySwapPanel";
import { AllocationBar, campaignAllocation } from "@/components/campaign/AllocationBar";
import { ProjectLogo } from "@/components/campaign/ProjectLogo";
import { campaignStatusLabel, CampaignStatusBadge } from "@/components/campaign/StatusBadges";
import { AddressChip } from "@/components/ui/AddressChip";
import { Badge, SourceBadge, type Tone } from "@/components/ui/Badge";
import { adminRepository } from "@/lib/auth/admin-data";
import { getConfig } from "@/lib/config";
import { fromBaseUnits } from "@/lib/economics/rewards";
import { formatDateTime, formatInt, formatPercent, formatUsdCents } from "@/lib/format";
import { CAMPAIGN_STATUSES, RISK_LEVELS, type DistributionStatus } from "@/lib/types";
import { shortenAddress } from "@/lib/validation/solana";
import {
  planDistributionAction,
  reconcileDistributionsAction,
  recordSimulatedPurchaseAction,
  setCampaignStatusAction,
  simulateDistributionAction,
  snapshotFromChainAction,
  snapshotFromCsvAction,
  updateCampaignAction,
  verifyPurchaseSignatureAction,
} from "../../../actions";

export const metadata = { title: "Campaign" };

function Panel({ title, children, aside, step }: { title: string; children: ReactNode; aside?: ReactNode; step?: number }) {
  return (
    <section className="surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {step && (
            <span className="tabular inline-flex size-5 items-center justify-center rounded-sm border border-violet-500/30 bg-violet-500/10 font-mono text-[10px] text-violet-300">
              {step}
            </span>
          )}
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** ISO → value for <input type="datetime-local"> in UTC. */
function toLocalInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 16) : "";
}

const DIST_TONE: Record<DistributionStatus, Tone> = { planned: "neutral", submitted: "sky", confirmed: "volt", simulated: "amber", skipped: "neutral" };

export default async function AdminCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { repo } = await adminRepository();
  const cfg = getConfig();
  const detail = repo.getCampaignById(id);
  if (!detail) notFound();
  const { campaign: c, purchases, snapshot, distributionSummary: ds } = detail;
  const distributions = repo.listDistributions(c.id);
  const spent = purchases.reduce((s, p) => s + p.usdcSpentCents, 0);
  const remaining = Math.max(0, c.rewardAllocationCents - spent);
  const live = cfg.treasuryLive && cfg.treasuryWallet;
  const tx = (sig: string) => `https://solscan.io/tx/${sig}${cfg.cluster === "devnet" ? "?cluster=devnet" : ""}`;
  const pendingCount = distributions.filter((d) => d.distributionStatus === "planned").length;
  const submittedCount = distributions.filter((d) => d.distributionStatus === "submitted").length;
  const started = distributions.some((d) => ["submitted", "confirmed", "simulated"].includes(d.distributionStatus));

  return (
    <div>
      <Link href="/admin/campaigns" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Campaigns
      </Link>

      <header className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ProjectLogo ticker={c.ticker} name={c.projectName} size={52} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {c.projectName} <span className="font-mono text-sm text-fg-subtle">${c.ticker}</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <CampaignStatusBadge status={c.status} />
              <SourceBadge source={c.source} />
              <Badge tone={live ? "volt" : "amber"}>{live ? "LIVE TREASURY" : "SIMULATED TREASURY"}</Badge>
              <AddressChip address={c.tokenAddress} kind="token" />
            </div>
          </div>
        </div>
        {c.status !== "cancelled" && (
          <Link href={`/campaigns/${c.slug}`} className="inline-flex items-center gap-1 text-sm text-violet-300 hover:text-violet-200">
            Public page <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* 1. Purchases */}
          <Panel step={1} title="Treasury purchase (reward allocation)" aside={<Badge tone={live ? "volt" : "amber"}>{live ? "On-chain" : "Simulated"}</Badge>}>
            <dl className="tabular grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-fg-subtle">Allocation</dt>
                <dd className="mt-0.5">{formatUsdCents(c.rewardAllocationCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-subtle">Purchased</dt>
                <dd className="mt-0.5">{formatUsdCents(spent)}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-subtle">Remaining</dt>
                <dd className="mt-0.5 text-volt-400">{formatUsdCents(remaining)}</dd>
              </div>
            </dl>

            <div className="mt-5">
              {live ? (
                <div className="space-y-5">
                  {cfg.cluster === "mainnet-beta" ? (
                    <TreasurySwapPanel campaignId={c.id} treasury={cfg.treasuryWallet!} ticker={c.ticker} remainingUsd={(remaining / 100).toFixed(2)} />
                  ) : (
                    <p className="text-sm text-fg-muted">Jupiter swaps run on mainnet only. On devnet, make the purchase elsewhere and verify it by signature below.</p>
                  )}
                  <AdminForm action={verifyPurchaseSignatureAction} hidden={{ campaignId: c.id }} submitLabel="Verify & record" submitVariant="secondary">
                    <label className="block">
                      <span className="text-xs text-fg-muted">Already swapped on jup.ag or elsewhere? Paste the transaction signature</span>
                      <input name="signature" required placeholder="Transaction signature" className="field mt-1 font-mono text-xs" />
                    </label>
                  </AdminForm>
                </div>
              ) : (
                <AdminForm
                  action={recordSimulatedPurchaseAction}
                  hidden={{ campaignId: c.id }}
                  submitLabel="Record simulated purchase"
                  confirm={{ title: "Record simulated purchase?", body: "Creates a SIMULATED purchase record. No funds move.", confirmLabel: "Record" }}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs text-fg-muted">USDC spent</span>
                      <input name="usdcSpent" required inputMode="decimal" placeholder={(remaining / 100).toFixed(2)} className="field tabular mt-1 font-mono" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-fg-muted">{c.ticker} acquired</span>
                      <input name="tokenAmount" required inputMode="decimal" placeholder="0.0" className="field tabular mt-1 font-mono" />
                    </label>
                  </div>
                  <input name="notes" placeholder="Notes (optional)" maxLength={500} className="field" aria-label="Notes" />
                </AdminForm>
              )}
            </div>

            {purchases.length > 0 && (
              <ul className="mt-5 space-y-2">
                {purchases.map((p) => (
                  <li key={p.id} className="rounded-md border border-ink-700 bg-ink-900 p-3 text-xs">
                    <div className="tabular flex justify-between text-sm">
                      <span>{formatUsdCents(p.usdcSpentCents)}</span>
                      <span>
                        {p.tokenAmount} {c.ticker}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-fg-subtle">
                      {formatDateTime(p.executedAt)} · <Badge tone={p.status === "confirmed" ? "volt" : "amber"}>{p.status.toUpperCase()}</Badge>
                      {p.transactionSignature && (
                        <a href={tx(p.transactionSignature)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-violet-300 hover:underline">
                          {shortenAddress(p.transactionSignature, 6)} <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* 2. Snapshot */}
          <Panel step={2} title="Holder snapshot" aside={snapshot ? <SourceBadge source={snapshot.source} /> : <Badge>None yet</Badge>}>
            {snapshot ? (
              <dl className="tabular grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-fg-subtle">Taken</dt>
                  <dd className="mt-0.5">{formatDateTime(snapshot.takenAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">Method</dt>
                  <dd className="mt-0.5 uppercase">{snapshot.method}{snapshot.slot ? ` · slot ${snapshot.slot}` : ""}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">Eligible holders</dt>
                  <dd className="mt-0.5">{formatInt(snapshot.holderCount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">Eligible RUNNER</dt>
                  <dd className="mt-0.5">{fromBaseUnits(BigInt(snapshot.eligibleSupply), snapshot.runnerDecimals, 2)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-fg-muted">Capture RUNNER balances at a single point in time. Rewards are split pro-rata over this snapshot.</p>
            )}
            {!started && (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <AdminForm
                  action={snapshotFromChainAction}
                  hidden={{ campaignId: c.id }}
                  submitLabel="Take on-chain snapshot"
                  submitVariant="secondary"
                  confirm={{
                    title: "Take snapshot now?",
                    body: (
                      <>
                        Reads every RUNNER holder from Solana right now and replaces any existing snapshot or unsent plan. Excluded:{" "}
                        {cfg.excludedWallets.length} wallet(s) (treasury + RUNNER_EXCLUDED_WALLETS).
                      </>
                    ),
                    confirmLabel: "Take snapshot",
                  }}
                >
                  <p className="flex items-start gap-2 text-xs text-fg-muted">
                    <Camera className="mt-0.5 size-3.5 shrink-0" />
                    {cfg.runnerMint ? <>Uses RUNNER mint {shortenAddress(cfg.runnerMint, 5)}. Needs an RPC that allows getProgramAccounts.</> : <>Set RUNNER_MINT in .env.local to enable.</>}
                  </p>
                </AdminForm>
                <AdminForm
                  action={snapshotFromCsvAction}
                  hidden={{ campaignId: c.id }}
                  submitLabel="Import CSV snapshot"
                  submitVariant="secondary"
                  confirm={{ title: "Import snapshot?", body: "Replaces any existing snapshot or unsent plan for this campaign.", confirmLabel: "Import" }}
                >
                  <input type="file" name="csv" accept=".csv,text/csv,text/plain" className="block w-full text-xs text-fg-muted file:mr-3 file:rounded-md file:border file:border-ink-600 file:bg-ink-800 file:px-3 file:py-1.5 file:text-fg" />
                  <label className="flex items-center gap-2 text-xs text-fg-muted">
                    Balances have
                    <input name="decimals" defaultValue="0" inputMode="numeric" className="field w-16 py-1 font-mono" aria-label="Decimals" /> decimals (0 = whole tokens; converted using these)
                  </label>
                  <p className="text-[11px] text-fg-subtle">Format: one <span className="font-mono">wallet,balance</span> per line (Solscan holder export works).</p>
                </AdminForm>
              </div>
            )}
          </Panel>

          {/* 3. Distribution */}
          <Panel step={3} title="Distribution" aside={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <a href={`/admin/campaigns/${c.id}/distributions.csv`} download className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200">
                <Download className="size-3.5" /> Export CSV
              </a>
              <Badge tone={live ? "volt" : "amber"}>{live ? "On-chain transfers" : "Simulated"}</Badge>
            </div>
          }>
            <dl className="tabular grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-fg-subtle">Recipients</dt>
                <dd className="mt-0.5">{formatInt(ds.recipientCount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-subtle">Pending</dt>
                <dd className="mt-0.5">{formatInt(pendingCount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-subtle">Confirmed</dt>
                <dd className="mt-0.5 text-volt-400">{formatInt(ds.confirmedCount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-subtle">Simulated</dt>
                <dd className="mt-0.5 text-amber-400">{formatInt(ds.simulatedCount)}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap items-start gap-3">
              {!started && (
                <AdminForm
                  inline
                  action={planDistributionAction}
                  hidden={{ campaignId: c.id }}
                  submitLabel={distributions.length ? "Rebuild plan" : "Create distribution plan"}
                  submitVariant="secondary"
                  confirm={{
                    title: "Create distribution plan?",
                    body: `Splits ${live ? "confirmed" : "recorded"} purchased tokens pro-rata over the snapshot. Amounts are floored; leftover dust stays in the treasury.`,
                    confirmLabel: "Create plan",
                  }}
                />
              )}
              {!live && pendingCount > 0 && (
                <AdminForm
                  inline
                  action={simulateDistributionAction}
                  hidden={{ campaignId: c.id }}
                  submitLabel="Mark all as simulated"
                  confirm={{ title: "Simulate distribution?", body: "Marks every pending recipient as SIMULATED. No tokens are sent.", confirmLabel: "Simulate" }}
                />
              )}
              {live && submittedCount > 0 && (
                <AdminForm inline action={reconcileDistributionsAction} hidden={{ campaignId: c.id }} submitLabel={`Check pending (${submittedCount})`} submitVariant="secondary" />
              )}
            </div>
            {live && pendingCount > 0 && submittedCount === 0 && (
              <div className="mt-4">
                <DistributionSender campaignId={c.id} treasury={cfg.treasuryWallet!} pending={pendingCount} batchSize={cfg.distributionBatchSize} />
                <p className="mt-2 text-[11px] text-fg-subtle">
                  The treasury pays ~0.002 SOL rent for each recipient without a {c.ticker} token account, plus network fees. Keep SOL in the treasury.
                </p>
              </div>
            )}

            <div className="-mx-5 mt-6 overflow-x-auto sm:-mx-6">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-y border-ink-700 text-left text-xs text-fg-subtle">
                  <tr>
                    <th className="px-5 py-2 font-medium sm:px-6">Wallet</th>
                    <th className="py-2 text-right font-medium">Balance</th>
                    <th className="py-2 text-right font-medium">Share</th>
                    <th className="py-2 text-right font-medium">Reward</th>
                    <th className="px-5 py-2 font-medium sm:px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-ink-700">
                  {distributions.slice(0, 200).map((d) => (
                    <tr key={d.id}>
                      <td className="px-5 py-2.5 font-mono text-xs sm:px-6">{shortenAddress(d.walletAddress, 6)}</td>
                      <td className="text-right">{fromBaseUnits(BigInt(d.runnerBalance), d.runnerDecimals, 2)}</td>
                      <td className="text-right">{formatPercent(d.rewardPercentage, 4)}</td>
                      <td className="text-right">
                        {d.rewardAmount} {c.ticker}
                      </td>
                      <td className="px-5 sm:px-6">
                        {d.transactionSignature ? (
                          <a href={tx(d.transactionSignature)} target="_blank" rel="noopener noreferrer">
                            <Badge tone={DIST_TONE[d.distributionStatus]}>{d.distributionStatus.toUpperCase()} ↗</Badge>
                          </a>
                        ) : (
                          <Badge tone={DIST_TONE[d.distributionStatus]}>{d.distributionStatus.toUpperCase()}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {distributions.length === 0 && <p className="px-6 py-6 text-sm text-fg-muted">No distribution plan yet.</p>}
              {distributions.length > 200 && <p className="px-6 py-3 text-xs text-fg-subtle">Showing the 200 largest of {formatInt(distributions.length)} recipients.</p>}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Campaign economics">
            <div className="tabular text-sm text-fg-muted">
              Fee <span className="text-fg">{formatUsdCents(c.totalCampaignFeeCents)}</span>
            </div>
            <AllocationBar allocation={campaignAllocation(c)} className="mt-3" />
          </Panel>

          <Panel title="Quick status change">
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_STATUSES.map((s) => (
                <AdminForm
                  key={s}
                  inline
                  disabled={s === c.status}
                  action={setCampaignStatusAction}
                  hidden={{ id: c.id, status: s }}
                  submitLabel={s === c.status ? `${campaignStatusLabel(s)} (current)` : `Mark ${campaignStatusLabel(s)}`}
                  submitVariant={s === "cancelled" ? "danger" : "secondary"}
                  confirm={{
                    title: `Change status to ${campaignStatusLabel(s)}?`,
                    body: s === "cancelled" ? "Cancelled campaigns are hidden from the public site." : "The public campaign page updates immediately.",
                    confirmLabel: "Change status",
                    tone: s === "cancelled" ? "danger" : "primary",
                  }}
                />
              ))}
            </div>
          </Panel>

          <Panel title="Edit campaign details">
            <AdminForm
              action={updateCampaignAction}
              hidden={{ id: c.id }}
              submitLabel="Save changes"
              confirm={{ title: "Save campaign changes?", body: "Changes are published to the public campaign page immediately.", confirmLabel: "Save" }}
            >
              {/* Re-key on save so uncontrolled inputs show stored values after React's post-action form reset. */}
              <div key={c.updatedAt} className="space-y-4">
                <label className="block">
                  <span className="text-xs text-fg-muted">Public description</span>
                  <textarea name="description" rows={4} defaultValue={c.description} className="field mt-1 resize-y" required minLength={10} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs text-fg-muted">Status</span>
                    <select name="status" defaultValue={c.status} className="field mt-1">
                      {CAMPAIGN_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {campaignStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-fg-muted">Risk level</span>
                    <select name="riskLevel" defaultValue={c.riskLevel} className="field mt-1 capitalize">
                      {RISK_LEVELS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs text-fg-muted">Announced snapshot time (UTC)</span>
                  <input type="datetime-local" name="snapshotAt" defaultValue={toLocalInput(c.snapshotAt)} className="field mt-1" />
                </label>
                <label className="flex items-center gap-2 text-sm text-fg-muted">
                  <input type="checkbox" name="featured" defaultChecked={c.featured} className="accent-violet-500" /> Featured on homepage
                </label>
              </div>
            </AdminForm>
          </Panel>
        </div>
      </div>
    </div>
  );
}
