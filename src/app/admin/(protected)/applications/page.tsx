import { Search } from "lucide-react";
import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/campaign/StatusBadges";
import { SourceBadge } from "@/components/ui/Badge";
import { adminRepository } from "@/lib/auth/admin-data";
import { cn } from "@/lib/cn";
import { CAMPAIGN_PACKAGES } from "@/lib/economics/allocation";
import { formatDate, formatUsdCents } from "@/lib/format";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";
import { shortenAddress } from "@/lib/validation/solana";

export const metadata = { title: "Applications" };

const TABS: { id: ApplicationStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "submitted", label: "Submitted" },
  { id: "under_review", label: "Under review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const status = (APPLICATION_STATUSES as string[]).includes(sp.status ?? "") ? (sp.status as ApplicationStatus) : "all";
  const q = (sp.q ?? "").slice(0, 80);
  const { repo } = await adminRepository();
  const apps = await repo.listApplications({ status, search: q });

  const href = (s: string) => {
    const p = new URLSearchParams();
    if (s !== "all") p.set("status", s);
    if (q) p.set("q", q);
    return `/admin/applications${p.size ? `?${p}` : ""}`;
  };

  return (
    <div>
      <p className="label text-violet-400">Admin</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Application management</h1>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1 rounded-md border border-ink-700 bg-ink-850 p-1">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={href(t.id)}
                className={cn("rounded-[5px] px-3 py-1.5 text-sm", status === t.id ? "bg-ink-700 text-fg" : "text-fg-muted hover:text-fg")}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
        <form className="relative" role="search">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input name="q" defaultValue={q} placeholder="Name, ticker, reference, address" aria-label="Search applications" className="field h-10 pl-9 lg:w-72" />
        </form>
      </div>

      <div className="surface mt-6 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-ink-700 text-left text-xs text-fg-subtle">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="py-3 font-medium">Reference</th>
              <th className="py-3 font-medium">Contract</th>
              <th className="py-3 font-medium">Applicant</th>
              <th className="py-3 font-medium">Package</th>
              <th className="py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700">
            {apps.map((a) => (
              <tr key={a.id} className="transition hover:bg-ink-800/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/applications/${a.id}`} className="font-medium hover:text-violet-300">
                    {a.projectName}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="font-mono text-xs text-fg-subtle">${a.ticker}</span>
                    {a.source === "demo" && <SourceBadge source="demo" className="h-5 px-1.5 text-[10px]" />}
                  </div>
                </td>
                <td className="font-mono text-xs text-fg-muted">{a.reference}</td>
                <td className="font-mono text-xs text-fg-muted">{shortenAddress(a.contractAddress, 5)}</td>
                <td className="font-mono text-xs text-fg-muted">{shortenAddress(a.applicantWallet, 5)}</td>
                <td className="tabular text-fg-muted">
                  {CAMPAIGN_PACKAGES[a.campaignPackage].name} · {formatUsdCents(CAMPAIGN_PACKAGES[a.campaignPackage].feeUsdCents)}
                </td>
                <td className="text-fg-muted">{formatDate(a.createdAt)}</td>
                <td className="px-4">
                  <ApplicationStatusBadge status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {apps.length === 0 && <p className="px-4 py-10 text-center text-sm text-fg-muted">No applications match.</p>}
      </div>
    </div>
  );
}
