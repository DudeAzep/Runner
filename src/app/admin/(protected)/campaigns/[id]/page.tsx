import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AdminForm } from "@/components/admin/AdminForm";
import { AllocationBar } from "@/components/campaign/AllocationBar";
import { ProjectLogo } from "@/components/campaign/ProjectLogo";
import { campaignStatusLabel, CampaignStatusBadge } from "@/components/campaign/StatusBadges";
import { AddressChip } from "@/components/ui/AddressChip";
import { Badge, SourceBadge } from "@/components/ui/Badge";
import { adminRepository } from "@/lib/auth/admin-data";
import { formatDateTime, formatInt, formatPercent, formatUsdCents } from "@/lib/format";
import { CAMPAIGN_STATUSES, RISK_LEVELS } from "@/lib/types";
import { shortenAddress } from "@/lib/validation/solana";
import { recordDistributionAction, recordPurchaseAction, setCampaignStatusAction, updateCampaignAction } from "../../../actions";

export const metadata = { title: "Campaign" };

function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
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

export default async function AdminCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { repo } = await adminRepository();
  const detail = await repo.getCampaignById(id);
  if (!detail) notFound();
  const { campaign: c, purchases } = detail;
  const distributions = await repo.listDistributions(c.id);
  const spent = purchases.reduce((s, p) => s + p.usdcSpentCents, 0);
  const remaining = c.rewardAllocationCents - spent;

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
                <label className="block">
                  <span className="text-xs text-fg-muted">Snapshot (UTC)</span>
                  <input type="datetime-local" name="snapshotAt" defaultValue={toLocalInput(c.snapshotAt)} className="field mt-1" />
                </label>
                <label className="block">
                  <span className="text-xs text-fg-muted">Eligible RUNNER supply at snapshot</span>
                  <input
                    name="eligibleSupply"
                    inputMode="numeric"
                    defaultValue={c.eligibleSupply ?? ""}
                    placeholder="e.g. 100000000"
                    className="field tabular mt-1 font-mono"
                    readOnly={distributions.length > 0}
                    title={distributions.length > 0 ? "Locked once distributions are recorded" : undefined}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-fg-muted">
                <input type="checkbox" name="featured" defaultChecked={c.featured} className="accent-violet-500" /> Featured on homepage
              </label>
              </div>
            </AdminForm>
          </Panel>

          <Panel title="Distributions" aside={<Badge tone="amber">Simulated — no transfers</Badge>}>
            <p className="text-sm text-fg-muted">
              Record a holder&apos;s snapshot balance. The reward is calculated as balance ÷ eligible supply × total purchased tokens, floored to
              the smallest unit. Totals can never exceed the reward pool.
            </p>
            <AdminForm
              action={recordDistributionAction}
              hidden={{ campaignId: c.id }}
              submitLabel="Record simulated distribution"
              className="mt-4"
              confirm={{
                title: "Record simulated distribution?",
                body: "This creates a SIMULATED distribution record. No tokens are sent and no transaction signature is stored.",
                confirmLabel: "Record",
              }}
            >
              <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
                <input name="walletAddress" required placeholder="Holder wallet address" className="field font-mono text-[13px]" aria-label="Holder wallet address" />
                <input name="runnerBalance" required inputMode="numeric" placeholder="RUNNER balance" className="field tabular font-mono" aria-label="RUNNER balance" />
              </div>
            </AdminForm>

            <div className="-mx-5 mt-6 overflow-x-auto sm:-mx-6">
              <table className="w-full min-w-[600px] text-sm">
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
                  {distributions.map((d) => (
                    <tr key={d.id}>
                      <td className="px-5 py-2.5 font-mono text-xs sm:px-6">{shortenAddress(d.walletAddress, 6)}</td>
                      <td className="text-right">{formatInt(BigInt(d.runnerBalance))}</td>
                      <td className="text-right">{formatPercent(d.rewardPercentage, 4)}</td>
                      <td className="text-right">
                        {d.rewardAmount} {c.ticker}
                      </td>
                      <td className="px-5 sm:px-6">
                        <Badge tone={d.distributionStatus === "confirmed" ? "volt" : "amber"}>{d.distributionStatus.toUpperCase()}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {distributions.length === 0 && <p className="px-6 py-6 text-sm text-fg-muted">No distributions recorded.</p>}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Campaign economics">
            <div className="tabular text-sm text-fg-muted">
              Fee <span className="text-fg">{formatUsdCents(c.totalCampaignFeeCents)}</span>
            </div>
            <AllocationBar totalCents={c.totalCampaignFeeCents} className="mt-3" />
          </Panel>

          <Panel title="Quick status change">
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_STATUSES.map((s) => (
                <AdminForm
                  key={s}
                  inline
                  action={setCampaignStatusAction}
                  hidden={{ id: c.id, status: s }}
                  submitLabel={s === c.status ? `${campaignStatusLabel(s)} (current)` : `Mark ${campaignStatusLabel(s)}`}
                  disabled={s === c.status}
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

          <Panel title="Treasury purchases" aside={<Badge tone="amber">Simulated</Badge>}>
            <dl className="tabular grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-fg-subtle">Purchased</dt>
                <dd className="mt-0.5">{formatUsdCents(spent)}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-subtle">Remaining of 70%</dt>
                <dd className="mt-0.5 text-volt-400">{formatUsdCents(remaining)}</dd>
              </div>
            </dl>
            <AdminForm
              action={recordPurchaseAction}
              hidden={{ campaignId: c.id }}
              submitLabel="Record simulated purchase"
              className="mt-4"
              confirm={{
                title: "Record simulated treasury purchase?",
                body: "Creates a SIMULATED purchase record against this campaign's 70% reward allocation. No funds move.",
                confirmLabel: "Record",
              }}
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
                    <div className="mt-1 text-fg-subtle">
                      {formatDateTime(p.executedAt)} · {p.status.toUpperCase()} · {p.transactionSignature ? shortenAddress(p.transactionSignature, 8) : "no signature"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
