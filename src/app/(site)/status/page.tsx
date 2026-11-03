import { ArrowRight, CreditCard, FlaskConical, Inbox } from "lucide-react";
import type { Metadata } from "next";
import { ApplicationStatusBadge } from "@/components/campaign/StatusBadges";
import { Container, PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { PayWithWallet } from "@/components/wallet/PayWithWallet";
import { WalletGate } from "@/components/wallet/WalletGate";
import { getWalletSession } from "@/lib/auth/wallet";
import { cn } from "@/lib/cn";
import { getPublicConfig } from "@/lib/config";
import { getRepositoryForRequest } from "@/lib/data";
import type { PublicApplicationStatus } from "@/lib/data/repository";
import { CAMPAIGN_PACKAGES } from "@/lib/economics/allocation";
import { formatDateTime, formatUsdCents } from "@/lib/format";
import { TestPayButton } from "./TestPayButton";

export const metadata: Metadata = { title: "Application Status" };

type StepState = "done" | "current" | "todo" | "failed";

function steps(a: PublicApplicationStatus): { label: string; body: string; state: StepState }[] {
  const reviewed = a.status !== "submitted";
  const decided = a.status === "approved" || a.status === "rejected";
  const paid = a.paymentStatus !== "awaiting_payment";
  const rejected = a.status === "rejected";
  const approved = a.status === "approved";
  return [
    { label: "Submitted", body: "Application received and queued for screening.", state: "done" },
    {
      label: "Under review",
      body: "RUNNER is screening liquidity, holders, token authorities, and activity.",
      state: reviewed ? "done" : "current",
    },
    {
      label: rejected ? "Not approved" : approved ? "Approved" : "Decision",
      body: rejected ? "This project didn't pass screening. No fee is due." : "Approved projects are asked to pay the campaign fee.",
      state: rejected ? "failed" : decided ? "done" : a.status === "under_review" ? "current" : "todo",
    },
    {
      label: "Fee paid",
      body: "Pay the package fee in USDC. It's only requested after approval.",
      state: rejected ? "todo" : paid && approved ? "done" : approved ? "current" : "todo",
    },
    {
      label: "Campaign live",
      body: "Your campaign is scheduled and listed on Explore.",
      state: a.campaignSlug ? "done" : approved && paid ? "current" : "todo",
    },
  ];
}

function PaymentBadge({ a }: { a: PublicApplicationStatus }) {
  if (a.paymentStatus === "paid") return <Badge tone="volt">Fee paid · verified</Badge>;
  if (a.paymentStatus === "test_mode_simulated") return <Badge tone="amber">TEST MODE payment</Badge>;
  if (a.status === "approved") return <Badge tone="violet">Payment due</Badge>;
  return <Badge>No payment yet</Badge>;
}

export default async function StatusPage() {
  const sessionWallet = await getWalletSession();
  const repo = await getRepositoryForRequest();
  const apps = sessionWallet ? repo.listApplicationsForWallet(sessionWallet) : [];
  const cfg = getPublicConfig();

  return (
    <Container className="max-w-3xl">
      <PageHeader eyebrow="Applications" title="Application status" description="Track your project applications and pay the campaign fee once approved." />

      <WalletGate
        sessionWallet={sessionWallet}
        title="Sign in to see your applications"
        description="Your applications are linked to the wallet you applied with. Sign in with that wallet to see their status."
      >
        {apps.length === 0 ? (
          <div className="surface flex flex-col items-center px-6 py-14 text-center">
            <Inbox className="size-8 text-fg-subtle" aria-hidden />
            <h2 className="mt-4 text-base font-semibold">No applications for this wallet</h2>
            <p className="mt-2 max-w-sm text-sm text-fg-muted">Applications you submit while signed in with this wallet will show up here.</p>
            <ButtonLink href="/submit" className="mt-6">
              Submit a project
            </ButtonLink>
          </div>
        ) : (
          <div className="space-y-6">
            {apps.map((a) => {
              const pkg = CAMPAIGN_PACKAGES[a.campaignPackage];
              const due = a.status === "approved" && a.paymentStatus === "awaiting_payment";
              return (
                <article key={a.reference} className="surface p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-mono text-sm text-violet-300">{a.reference}</div>
                      <h2 className="mt-1 text-xl font-semibold">
                        {a.projectName} <span className="font-mono text-sm text-fg-subtle">${a.ticker}</span>
                      </h2>
                      <p className="mt-1 text-sm text-fg-muted">
                        {pkg.name} package · Submitted {formatDateTime(a.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <ApplicationStatusBadge status={a.status} />
                      <PaymentBadge a={a} />
                    </div>
                  </div>

                  {due && (
                    <div className="mt-6 rounded-lg border border-volt-400/30 bg-volt-400/[0.05] p-5">
                      <div className="flex items-center gap-2">
                        <CreditCard className="size-4 text-volt-400" aria-hidden />
                        <h3 className="text-[15px] font-semibold">Approved: pay {formatUsdCents(pkg.feeUsdCents)} USDC to launch your campaign</h3>
                      </div>
                      <p className="mt-2 text-sm text-fg-muted">
                        {pkg.allocationBps.reward / 100}% of the fee buys your token for RUNNER holders. Your campaign is created once the fee is paid.
                      </p>
                      <div className="mt-4">
                        {cfg.paymentsLive ? (
                          <PayWithWallet reference={a.reference} amountUsd={(pkg.feeUsdCents / 100).toFixed(2)} cluster={cfg.cluster} />
                        ) : (
                          <>
                            <p className="mb-3 flex items-center gap-1.5 text-xs text-amber-400">
                              <FlaskConical className="size-3.5" aria-hidden /> TEST MODE: no real payment is taken.
                            </p>
                            <TestPayButton reference={a.reference} amountLabel={formatUsdCents(pkg.feeUsdCents)} />
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {a.paymentSignature && (
                    <p className="mt-4 break-all font-mono text-xs text-fg-subtle">
                      Payment tx:{" "}
                      <a
                        className="text-violet-300 hover:underline"
                        href={`https://solscan.io/tx/${a.paymentSignature}${cfg.cluster === "devnet" ? "?cluster=devnet" : ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {a.paymentSignature}
                      </a>
                    </p>
                  )}

                  <ol className="mt-8">
                    {steps(a).map((s, i, all) => (
                      <li key={s.label} className="relative flex gap-4 pb-6 last:pb-0">
                        {i < all.length - 1 && (
                          <span aria-hidden className={cn("absolute left-[11px] top-6 h-[calc(100%-12px)] w-px", s.state === "done" ? "bg-violet-500" : "bg-ink-600")} />
                        )}
                        <span
                          className={cn(
                            "relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]",
                            s.state === "done" && "border-violet-500 bg-violet-500 text-white",
                            s.state === "current" && "border-amber-400 bg-amber-400/15 text-amber-400",
                            s.state === "failed" && "border-rose-400 bg-rose-400/15 text-rose-400",
                            s.state === "todo" && "border-ink-600 text-fg-subtle",
                          )}
                        >
                          {i + 1}
                        </span>
                        <div>
                          <div className={cn("text-sm font-medium", s.state === "todo" && "text-fg-subtle")}>{s.label}</div>
                          <p className="mt-0.5 text-sm text-fg-muted">{s.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-fg-subtle">Last updated {formatDateTime(a.updatedAt)}.</p>
                    {a.campaignSlug && (
                      <ButtonLink href={`/campaigns/${a.campaignSlug}`} variant="secondary" size="sm">
                        View campaign <ArrowRight className="size-4" />
                      </ButtonLink>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </WalletGate>
    </Container>
  );
}
