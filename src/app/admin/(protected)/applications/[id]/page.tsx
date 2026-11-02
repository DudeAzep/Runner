import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AdminForm } from "@/components/admin/AdminForm";
import { ScreeningFields } from "@/components/admin/ScreeningFields";
import { AllocationBar } from "@/components/campaign/AllocationBar";
import { ProjectLogo } from "@/components/campaign/ProjectLogo";
import { averageScore } from "@/components/campaign/ScreeningReport";
import { SocialLinks } from "@/components/campaign/SocialLinks";
import { ApplicationStatusBadge, CampaignStatusBadge } from "@/components/campaign/StatusBadges";
import { AddressChip } from "@/components/ui/AddressChip";
import { Badge, SourceBadge } from "@/components/ui/Badge";
import { adminRepository } from "@/lib/auth/admin-data";
import { CAMPAIGN_PACKAGES } from "@/lib/economics/allocation";
import { formatDateTime, formatUsdCents } from "@/lib/format";
import { createCampaignAction, saveScreeningAction, setApplicationStatusAction } from "../../../actions";

export const metadata = { title: "Application" };

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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 text-sm sm:grid-cols-[160px_1fr]">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { repo } = await adminRepository();
  const detail = await repo.getApplicationDetail(id);
  if (!detail) notFound();
  const { application: a, screening, campaign } = detail;
  const pkg = CAMPAIGN_PACKAGES[a.campaignPackage];
  const decided = a.status === "approved" || a.status === "rejected";

  return (
    <div>
      <Link href="/admin/applications" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Applications
      </Link>

      <header className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ProjectLogo ticker={a.ticker} name={a.projectName} size={52} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {a.projectName} <span className="font-mono text-sm text-fg-subtle">${a.ticker}</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ApplicationStatusBadge status={a.status} />
              <Badge>{a.reference}</Badge>
              <SourceBadge source={a.source} />
            </div>
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Panel title="Project details">
            <dl className="divide-y divide-ink-700">
              <Row label="Contract address">
                <AddressChip address={a.contractAddress} kind="token" full />
              </Row>
              <Row label="Applicant wallet">
                <AddressChip address={a.applicantWallet} full />
              </Row>
              <Row label="Social links">
                <div className="space-y-1.5">
                  <SocialLinks links={a} />
                  <ul className="space-y-0.5 text-xs text-fg-muted">
                    {[a.website, a.twitter, a.telegram, a.discord].filter(Boolean).map((u) => (
                      <li key={u} className="break-all font-mono">
                        {u}
                      </li>
                    ))}
                  </ul>
                </div>
              </Row>
              <Row label="Description">
                <p className="leading-relaxed text-fg-muted">{a.description}</p>
              </Row>
              <Row label="Requested package">
                {pkg.name} · {formatUsdCents(pkg.feeUsdCents)} USDC
              </Row>
              <Row label="Payment">
                <Badge tone="amber">{a.paymentStatus === "test_mode_simulated" ? "TEST MODE — simulated" : "Unpaid"}</Badge>
              </Row>
              <Row label="Submitted">{formatDateTime(a.createdAt)}</Row>
            </dl>
          </Panel>

          <Panel
            title="Screening"
            aside={screening ? <span className="tabular text-xs text-fg-subtle">Avg {averageScore(screening).toFixed(1)}/10 · {screening.reviewedBy}</span> : <Badge>Not screened</Badge>}
          >
            <AdminForm action={saveScreeningAction} hidden={{ applicationId: a.id }} submitLabel={screening ? "Update screening report" : "Save screening report"}>
              {/* Re-key on save so uncontrolled inputs pick up the stored values after React's post-action form reset. */}
              <ScreeningFields key={screening?.createdAt ?? "new"} screening={screening} />
            </AdminForm>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Decision">
            <p className="text-sm text-fg-muted">
              Decisions must be based on screening results only. The fee paid does not influence approval.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
                <AdminForm
                  inline
                  disabled={a.status === "approved"}
                  action={setApplicationStatusAction}
                  hidden={{ id: a.id, status: "approved" }}
                  submitLabel={a.status === "approved" ? "Approved" : "Approve application"}
                  submitVariant="volt"
                  confirm={{
                    title: `Approve ${a.projectName}?`,
                    body: screening ? (
                      <>The application will be marked approved. You can then create its campaign.</>
                    ) : (
                      <>No screening report has been saved yet — approval will be refused until one exists.</>
                    ),
                    confirmLabel: "Approve",
                    tone: "volt",
                  }}
                />
                <AdminForm
                  inline
                  disabled={a.status === "rejected"}
                  action={setApplicationStatusAction}
                  hidden={{ id: a.id, status: "rejected" }}
                  submitLabel={a.status === "rejected" ? "Rejected" : "Reject application"}
                  submitVariant="danger"
                  confirm={{
                    title: `Reject ${a.projectName}?`,
                    body: "The applicant will see a Not approved status. It can be reopened later.",
                    confirmLabel: "Reject",
                    tone: "danger",
                  }}
                />
              {decided && (
                <AdminForm
                  inline
                  action={setApplicationStatusAction}
                  hidden={{ id: a.id, status: "under_review" }}
                  submitLabel="Reopen review"
                  submitVariant="secondary"
                  confirm={{ title: "Reopen review?", body: "The application returns to Under review.", confirmLabel: "Reopen" }}
                />
              )}
            </div>
          </Panel>

          <Panel title="Campaign">
            {campaign ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{campaign.projectName}</span>
                  <CampaignStatusBadge status={campaign.status} />
                </div>
                <AllocationBar totalCents={campaign.totalCampaignFeeCents} />
                <Link href={`/admin/campaigns/${campaign.id}`} className="inline-flex items-center gap-1 text-sm text-violet-300 hover:text-violet-200">
                  Manage campaign <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            ) : a.status === "approved" ? (
              <AdminForm
                action={createCampaignAction}
                hidden={{ applicationId: a.id }}
                submitLabel="Create campaign"
                confirm={{
                  title: "Create campaign?",
                  body: (
                    <>
                      Creates a public {pkg.name} campaign with a {formatUsdCents(pkg.feeUsdCents)} fee split 70/20/10. It will appear on Explore
                      immediately.
                    </>
                  ),
                  confirmLabel: "Create",
                }}
              >
                <AllocationBar totalCents={pkg.feeUsdCents} />
                <label className="block">
                  <span className="text-xs text-fg-muted">Initial status</span>
                  <select name="status" defaultValue="upcoming" className="field mt-1">
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Live</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-fg-muted">Snapshot date (UTC)</span>
                  <input type="datetime-local" name="snapshotAt" className="field mt-1" />
                </label>
                <label className="flex items-center gap-2 text-sm text-fg-muted">
                  <input type="checkbox" name="featured" className="accent-violet-500" /> Featured on homepage
                </label>
              </AdminForm>
            ) : (
              <p className="text-sm text-fg-muted">Approve the application to create a campaign.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
