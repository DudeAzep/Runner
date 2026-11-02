"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  Activity,
  CalendarClock,
  Calculator,
  Coins,
  FlaskConical,
  History,
  Inbox,
  Layers,
  LogOut,
  Receipt,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ProjectLogo } from "@/components/campaign/ProjectLogo";
import { CampaignStatusBadge } from "@/components/campaign/StatusBadges";
import { AddressChip } from "@/components/ui/AddressChip";
import { Badge, SourceBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { estimateUsdReward } from "@/lib/economics/rewards";
import { formatDate, formatDateTime, formatInt, formatPercent, formatUsdCents } from "@/lib/format";
import type { CampaignStatus, DataSource } from "@/lib/types";
import { fetchWalletDistributions, type WalletDistributionItem } from "./actions";

export interface DashboardCampaign {
  slug: string;
  projectName: string;
  ticker: string;
  status: CampaignStatus;
  rewardAllocationCents: number;
  snapshotAt: string | null;
  source: DataSource;
}

interface DemoBundle {
  wallet: string;
  runnerBalance: number;
  eligibleSupply: number;
  distributions: WalletDistributionItem[];
  participated: { slug: string; projectName: string; ticker: string; snapshotAt: string | null; rewardAllocationCents: number }[];
}

type Mode = "none" | "connected" | "demo";

function Card({ title, icon, children, aside, className }: { title: string; icon?: ReactNode; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={`surface p-5 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-md border border-dashed border-ink-600 px-4 py-8 text-center text-sm text-fg-muted">
      <Inbox className="mb-2 size-5 text-fg-subtle" aria-hidden />
      {children}
    </div>
  );
}

export function HolderDashboard({ eligibleCampaigns, demo }: { eligibleCampaigns: DashboardCampaign[]; demo: DemoBundle }) {
  const { publicKey, wallet, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [demoMode, setDemoMode] = useState(false);
  const [live, setLive] = useState<{ address: string; items: WalletDistributionItem[] } | null>(null);
  const [estimateInput, setEstimateInput] = useState("");

  const connectedAddress = publicKey?.toBase58() ?? null;
  const mode: Mode = demoMode ? "demo" : connectedAddress ? "connected" : "none";

  const liveDistributions = connectedAddress && live?.address === connectedAddress ? live.items : null;

  useEffect(() => {
    if (!connectedAddress) return;
    let cancelled = false;
    fetchWalletDistributions(connectedAddress).then((r) => {
      if (!cancelled) setLive({ address: connectedAddress, items: r.items });
    });
    return () => {
      cancelled = true;
    };
  }, [connectedAddress]);

  const address = mode === "demo" ? demo.wallet : connectedAddress;
  const balance = mode === "demo" ? demo.runnerBalance : null; // live balance lookup not enabled in MVP
  const distributions = mode === "demo" ? demo.distributions : (liveDistributions ?? []);

  const estimateBalance = useMemo(() => {
    const raw = estimateInput.replace(/[,_\s]/g, "");
    if (/^\d{1,15}$/.test(raw)) return Math.min(Number(raw), demo.eligibleSupply);
    return balance ?? 0;
  }, [estimateInput, balance, demo.eligibleSupply]);

  const estimates = eligibleCampaigns.map((c) => ({
    ...c,
    est: estimateUsdReward(BigInt(estimateBalance), BigInt(demo.eligibleSupply), c.rewardAllocationCents),
  }));
  const totalEstimateCents = estimates.reduce((s, e) => s + e.est.rewardUsdCents, 0);
  const share = estimateBalance > 0 ? (estimateBalance / demo.eligibleSupply) * 100 : 0;

  if (mode === "none") {
    return (
      <div className="space-y-6">
        <div className="surface relative overflow-hidden px-6 py-14 text-center sm:px-12">
          <div aria-hidden className="absolute left-1/2 top-0 h-48 w-[600px] -translate-x-1/2 bg-[radial-gradient(closest-side,rgb(139_92_246/0.18),transparent)]" />
          <div className="relative mx-auto max-w-md">
            <span className="inline-flex size-12 items-center justify-center rounded-md border border-ink-600 bg-ink-850">
              <Wallet className="size-5 text-violet-300" />
            </span>
            <h2 className="mt-5 text-xl font-semibold">Connect a wallet to view your dashboard</h2>
            <p className="mt-2 text-sm text-fg-muted">
              RUNNER only reads your public address. It never asks for signatures or moves funds.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <WalletConnectButton size="md" />
              <Button variant="secondary" onClick={() => setDemoMode(true)}>
                <FlaskConical className="size-4 text-amber-400" /> Preview with demo wallet
              </Button>
            </div>
          </div>
        </div>
        <div className="grid gap-4 opacity-60 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
          {["RUNNER balance", "Eligible campaigns", "Estimated rewards", "Distributions received"].map((l) => (
            <div key={l} className="surface p-5">
              <div className="label">{l}</div>
              <div className="mt-3 h-7 w-24 rounded-sm bg-ink-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mode === "demo" ? (
        <div className="flex flex-col gap-3 rounded-md border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-fg-muted">
            <FlaskConical className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <span>
              <span className="font-medium text-amber-400">DEMO WALLET.</span> You are viewing a fictional wallet with sample balances and
              simulated distributions. These are not your holdings and no rewards were sent.
            </span>
          </p>
          <Button variant="secondary" size="sm" onClick={() => setDemoMode(false)}>
            Exit demo
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-violet-500/30 bg-violet-500/[0.06] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-fg-muted">
            Live RUNNER balance lookup is not enabled in this MVP. Only distributions recorded for your address are shown — nothing is
            assumed.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setDemoMode(true)}>
            <FlaskConical className="size-4 text-amber-400" /> View demo wallet
          </Button>
        </div>
      )}

      {/* 1–4: overview row */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Wallet overview" icon={<Wallet className="size-4 text-violet-400" />} className="lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-2">
              {address && <AddressChip address={address} />}
              <div className="flex flex-wrap gap-1.5 text-xs text-fg-subtle">
                <Badge>{mode === "demo" ? "Demo wallet" : wallet?.adapter.name ?? "Wallet"}</Badge>
                <Badge>Solana mainnet</Badge>
                {mode === "demo" ? <SourceBadge source="demo" /> : <Badge tone="volt" dot>Connected</Badge>}
              </div>
            </div>
            {mode === "connected" ? (
              <Button variant="danger" size="sm" onClick={() => void disconnect()}>
                <LogOut className="size-4" /> Disconnect
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => (connectedAddress ? setDemoMode(false) : setVisible(true))}>
                <Wallet className="size-4" /> {connectedAddress ? "Back to my wallet" : "Connect real wallet"}
              </Button>
            )}
          </div>
        </Card>
        <Card title="RUNNER balance" icon={<Coins className="size-4 text-volt-400" />}>
          {balance != null ? (
            <>
              <div className="tabular text-2xl font-semibold tracking-tight">{formatInt(balance)}</div>
              <div className="mt-1 text-xs text-fg-subtle">{formatPercent((balance / demo.eligibleSupply) * 100)} of eligible supply</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-semibold tracking-tight text-fg-subtle">—</div>
              <div className="mt-1 text-xs text-fg-subtle">Unverified · on-chain lookup coming soon</div>
            </>
          )}
        </Card>
        <Card title="Eligible campaigns" icon={<Layers className="size-4 text-violet-400" />}>
          <div className="tabular text-2xl font-semibold tracking-tight">{eligibleCampaigns.length}</div>
          <div className="mt-1 text-xs text-fg-subtle">Live or upcoming, before snapshot</div>
        </Card>
      </div>

      {/* 3 + 4: eligible campaigns + estimator */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Eligible reward campaigns" icon={<CalendarClock className="size-4 text-violet-400" />}>
          {estimates.length ? (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-fg-subtle">
                  <tr className="border-b border-ink-700">
                    <th className="px-5 pb-2 font-medium">Campaign</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Snapshot</th>
                    <th className="pb-2 text-right font-medium">Pool</th>
                    <th className="px-5 pb-2 text-right font-medium">Est. share</th>
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-ink-700">
                  {estimates.map((c) => (
                    <tr key={c.slug} className="transition hover:bg-ink-800/60">
                      <td className="px-5 py-3">
                        <Link href={`/campaigns/${c.slug}`} className="flex items-center gap-2.5">
                          <ProjectLogo ticker={c.ticker} name={c.projectName} size={28} />
                          <span>
                            <span className="block font-medium">{c.projectName}</span>
                            <span className="font-mono text-xs text-fg-subtle">${c.ticker}</span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <CampaignStatusBadge status={c.status} />
                      </td>
                      <td className="text-fg-muted">{c.snapshotAt ? formatDate(c.snapshotAt) : "TBA"}</td>
                      <td className="text-right">{formatUsdCents(c.rewardAllocationCents)}</td>
                      <td className="px-5 text-right text-volt-400">
                        {estimateBalance > 0 ? (c.est.isBelowOneCent ? "< $0.01" : formatUsdCents(c.est.rewardUsdCents, { forceCents: true })) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No campaigns are currently open for eligibility.</Empty>
          )}
          <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
            Estimates use the formula balance ÷ eligible supply × pool, assuming {formatInt(demo.eligibleSupply)} eligible RUNNER (illustrative).
            Actual rewards depend on the published snapshot and are paid in the project token, whose value can change.
          </p>
        </Card>

        <Card title="Estimated proportional rewards" icon={<Calculator className="size-4 text-volt-400" />}>
          <label htmlFor="est" className="text-xs text-fg-muted">
            RUNNER balance to estimate {balance == null && "(enter a hypothetical amount)"}
          </label>
          <input
            id="est"
            inputMode="numeric"
            value={estimateInput}
            onChange={(e) => setEstimateInput(e.target.value)}
            placeholder={balance != null ? formatInt(balance) : "e.g. 250,000"}
            className="field tabular mt-1.5 font-mono"
          />
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-fg-muted">Share of eligible supply</dt>
              <dd className="tabular font-medium">{formatPercent(share, 4)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-fg-muted">Combined pools</dt>
              <dd className="tabular font-medium">{formatUsdCents(estimates.reduce((s, e) => s + e.rewardAllocationCents, 0))}</dd>
            </div>
            <div className="flex justify-between border-t border-ink-700 pt-3">
              <dt className="text-fg-muted">Estimated value at purchase</dt>
              <dd className="tabular text-lg font-semibold text-volt-400">{formatUsdCents(totalEstimateCents, { forceCents: true })}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-fg-subtle">Estimate only. Not a promise of rewards or returns.</p>
        </Card>
      </div>

      {/* 5: previous distributions */}
      <Card
        title="Previous distributions"
        icon={<Receipt className="size-4 text-violet-400" />}
        aside={mode === "demo" ? <SourceBadge source="demo" /> : undefined}
      >
        {distributions.length ? (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-fg-subtle">
                <tr className="border-b border-ink-700">
                  <th className="px-5 pb-2 font-medium">Campaign</th>
                  <th className="pb-2 font-medium">Balance at snapshot</th>
                  <th className="pb-2 font-medium">Share</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                  <th className="pb-2 font-medium pl-6">Status</th>
                  <th className="px-5 pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-ink-700">
                {distributions.map((d) => (
                  <tr key={d.id}>
                    <td className="px-5 py-3">
                      <Link href={`/campaigns/${d.slug}`} className="font-medium hover:text-violet-300">
                        {d.projectName}
                      </Link>
                    </td>
                    <td>{formatInt(BigInt(d.runnerBalance))}</td>
                    <td>{formatPercent(d.rewardPercentage)}</td>
                    <td className="text-right">
                      {Number(d.rewardAmount).toLocaleString("en-US", { maximumFractionDigits: 2 })} {d.ticker}
                    </td>
                    <td className="pl-6">
                      {d.status === "confirmed" ? <Badge tone="volt">Confirmed</Badge> : <Badge tone="amber">SIMULATED</Badge>}
                    </td>
                    <td className="px-5 text-fg-muted">{formatDate(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            {liveDistributions === null && mode === "connected" ? "Loading…" : "No distributions have been recorded for this wallet."}
          </Empty>
        )}
      </Card>

      {/* 6–8 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Campaign participation history" icon={<History className="size-4 text-violet-400" />}>
          {mode === "demo" && demo.participated.length ? (
            <ul className="space-y-3">
              {demo.participated.map((p) => (
                <li key={p.slug} className="flex items-center gap-3">
                  <ProjectLogo ticker={p.ticker} name={p.projectName} size={28} />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-medium">{p.projectName}</div>
                    <div className="text-xs text-fg-subtle">Snapshot {p.snapshotAt ? formatDate(p.snapshotAt) : "—"}</div>
                  </div>
                  <Badge tone="volt">Included</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No verified campaign participation yet.</Empty>
          )}
        </Card>

        <Card title="Transaction history" icon={<Receipt className="size-4 text-violet-400" />}>
          {mode === "demo" ? (
            <ul className="space-y-3 text-sm">
              {demo.distributions.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">Reward · {d.ticker}</div>
                    <div className="text-xs text-fg-subtle">{formatDateTime(d.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="tabular text-volt-400">+{Number(d.rewardAmount).toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                    <div className="text-[11px] text-fg-subtle">No tx · simulated</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No RUNNER-related transactions found.</Empty>
          )}
        </Card>

        <Card title="Wallet activity" icon={<Activity className="size-4 text-violet-400" />}>
          {mode === "demo" ? (
            <ol className="relative space-y-4 border-l border-ink-600 pl-4 text-sm">
              {[
                ...eligibleCampaigns.slice(0, 2).map((c) => ({ k: `e-${c.slug}`, t: `Eligible for $${c.ticker} campaign`, d: c.snapshotAt ? `Snapshot ${formatDate(c.snapshotAt)}` : "Snapshot TBA" })),
                ...demo.participated.map((p) => ({ k: `s-${p.slug}`, t: `Included in $${p.ticker} snapshot`, d: p.snapshotAt ? formatDate(p.snapshotAt) : "" })),
              ].map((a) => (
                <li key={a.k} className="relative">
                  <span aria-hidden className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-ink-850 bg-violet-400" />
                  <div className="font-medium">{a.t}</div>
                  <div className="text-xs text-fg-subtle">{a.d}</div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Activity appears here after your first snapshot inclusion.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
