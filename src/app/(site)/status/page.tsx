import { ArrowRight, Search } from "lucide-react";
import type { Metadata } from "next";
import { ApplicationStatusBadge } from "@/components/campaign/StatusBadges";
import { Container, PageHeader } from "@/components/layout/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { getRepositoryForRequest } from "@/lib/data";
import { CAMPAIGN_PACKAGES } from "@/lib/economics/allocation";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ApplicationStatus } from "@/lib/types";
import { referenceSchema } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Application Status" };

const TIMELINE: { status: ApplicationStatus | "decision"; label: string; body: string }[] = [
  { status: "submitted", label: "Submitted", body: "Application received and queued for screening." },
  { status: "under_review", label: "Under review", body: "RUNNER is screening liquidity, holders, authorities, and activity." },
  { status: "decision", label: "Decision", body: "Approved projects are scheduled as campaigns. Rejected applications receive no campaign." },
];

export default async function StatusPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const parsed = ref ? referenceSchema.safeParse(ref) : null;
  const repo = await getRepositoryForRequest();
  const result = parsed?.success ? await repo.getApplicationStatus(parsed.data) : null;
  const stage = result ? (result.status === "submitted" ? 0 : result.status === "under_review" ? 1 : 2) : -1;

  return (
    <Container className="max-w-3xl">
      <PageHeader eyebrow="Applications" title="Application status" description="Enter the reference number you received after submitting (e.g. RUN-7Q4K2M)." />

      <form action="/status" className="flex flex-col gap-3 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input
            name="ref"
            defaultValue={ref ?? ""}
            placeholder="RUN-XXXXXX"
            aria-label="Reference number"
            className="field h-11 pl-9 font-mono uppercase tracking-wider"
            autoComplete="off"
          />
        </div>
        <Button type="submit" size="lg" className="h-11">
          Look up
        </Button>
      </form>

      {ref && parsed && !parsed.success && <p className="mt-4 text-sm text-rose-400">{parsed.error.issues[0]?.message}</p>}
      {ref && parsed?.success && !result && <p className="mt-4 text-sm text-fg-muted">No application found for {parsed.data}.</p>}

      {result && (
        <div className="surface mt-8 p-6 animate-fade-up">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono text-sm text-violet-300">{result.reference}</div>
              <h2 className="mt-1 text-xl font-semibold">
                {result.projectName} <span className="font-mono text-sm text-fg-subtle">${result.ticker}</span>
              </h2>
              <p className="mt-1 text-sm text-fg-muted">
                {CAMPAIGN_PACKAGES[result.campaignPackage].name} package · Submitted {formatDateTime(result.createdAt)}
              </p>
            </div>
            <ApplicationStatusBadge status={result.status} />
          </div>

          <ol className="mt-8 space-y-0">
            {TIMELINE.map((t, i) => {
              const done = i < stage || (i === stage && i === 2);
              const current = i === stage && i !== 2;
              return (
                <li key={t.label} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < TIMELINE.length - 1 && (
                    <span aria-hidden className={cn("absolute left-[11px] top-6 h-[calc(100%-12px)] w-px", i < stage ? "bg-violet-500" : "bg-ink-600")} />
                  )}
                  <span
                    className={cn(
                      "relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono",
                      done && "border-violet-500 bg-violet-500 text-white",
                      current && "border-amber-400 bg-amber-400/15 text-amber-400",
                      !done && !current && "border-ink-600 text-fg-subtle",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-medium">
                      {i === 2 && stage === 2 ? (result.status === "approved" ? "Approved" : "Not approved") : t.label}
                    </div>
                    <p className="mt-0.5 text-sm text-fg-muted">{t.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="mt-6 text-xs text-fg-subtle">Last updated {formatDateTime(result.updatedAt)}.</p>
          {result.campaignSlug && (
            <ButtonLink href={`/campaigns/${result.campaignSlug}`} variant="secondary" className="mt-4">
              View campaign <ArrowRight className="size-4" />
            </ButtonLink>
          )}
        </div>
      )}
    </Container>
  );
}
